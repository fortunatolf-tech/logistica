"""Núcleo de normalização: converte os 4 formatos de entrada no registro canônico.

Formatos aceitos (Bloco 2 da especificação):
  - exif:      foto (base64) com geotag EXIF
  - gps:       lat/lng/precisão reportados pelo dispositivo
  - plus_code: código completo ou curto (curto exige referência de proximidade)
  - endereco:  endereço completo, geocodificado via MapProvider (com fallback
               para Plus Code quando o endereço é impreciso)

Nenhuma dependência de framework neste módulo: FastAPI fica em `main.py`.
"""

from __future__ import annotations

import base64
import binascii
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from . import pluscode
from .exif_extract import GeoTagNotFound, extract_gps
from .geocoder import GeocodeNotFound, MapProvider
from .validation import BoundingBox, ValidationError, validar_plausibilidade

FONTES = ("exif", "gps", "plus_code", "endereco")


class NormalizeError(ValueError):
    """Erro estruturado de normalização."""

    def __init__(self, motivo: str, detalhe: str = ""):
        super().__init__(f"{motivo}: {detalhe}" if detalhe else motivo)
        self.motivo = motivo
        self.detalhe = detalhe


@dataclass
class NormalizeRequest:
    fonte: str
    # gps
    lat: float | None = None
    lng: float | None = None
    precisao_m: float | None = None
    # exif
    foto_base64: str | None = None
    # plus_code
    plus_code: str | None = None
    referencia_lat: float | None = None
    referencia_lng: float | None = None
    # endereco
    endereco: str | None = None
    # contexto
    tenant_id: str = "default"
    operador: str = "anonimo"


@dataclass
class AuditRecord:
    quem: str
    quando: str
    acao: str
    origem: str


@dataclass
class CanonicalLocation:
    lat: float
    lng: float
    precisao_m: float
    fonte: str
    timestamp: str
    plus_code_equivalente: str
    validado: bool
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    auditoria: list[AuditRecord] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "lat": self.lat,
            "lng": self.lng,
            "precisao_m": round(self.precisao_m, 1),
            "fonte": self.fonte,
            "timestamp": self.timestamp,
            "plus_code_equivalente": self.plus_code_equivalente,
            "validado": self.validado,
            "auditoria": [vars(a) for a in self.auditoria],
        }


class LocationRepository(Protocol):
    """Persistência do registro normalizado + trilha de auditoria."""

    def salvar(self, location: CanonicalLocation, tenant_id: str) -> None: ...


class InMemoryLocationRepository:
    """Repositório em memória — desenvolvimento e testes."""

    def __init__(self) -> None:
        self.registros: list[tuple[str, CanonicalLocation]] = []

    def salvar(self, location: CanonicalLocation, tenant_id: str) -> None:
        self.registros.append((tenant_id, location))


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _resolver(req: NormalizeRequest, provider: MapProvider) -> tuple[float, float, float]:
    """Extrai (lat, lng, precisao_m) do formato de entrada correspondente."""
    if req.fonte == "gps":
        if req.lat is None or req.lng is None:
            raise NormalizeError("payload_incompleto", "GPS exige lat e lng")
        return req.lat, req.lng, float(req.precisao_m or 10.0)

    if req.fonte == "exif":
        if not req.foto_base64:
            raise NormalizeError("payload_incompleto", "EXIF exige foto_base64")
        try:
            foto = base64.b64decode(req.foto_base64, validate=True)
        except binascii.Error as exc:
            raise NormalizeError("foto_invalida", "base64 malformado") from exc
        try:
            r = extract_gps(foto)
        except GeoTagNotFound as exc:
            raise NormalizeError("sem_geotag", str(exc)) from exc
        return r.lat, r.lng, r.precisao_m

    if req.fonte == "plus_code":
        if not req.plus_code:
            raise NormalizeError("payload_incompleto", "Informe plus_code")
        codigo = req.plus_code
        try:
            if pluscode.is_short(codigo):
                if req.referencia_lat is None or req.referencia_lng is None:
                    raise NormalizeError(
                        "referencia_ausente",
                        "Plus Code curto exige referencia_lat/referencia_lng",
                    )
                codigo = pluscode.recover_nearest(
                    codigo, req.referencia_lat, req.referencia_lng
                )
            area = pluscode.decode(codigo)
        except pluscode.InvalidPlusCode as exc:
            raise NormalizeError("plus_code_invalido", str(exc)) from exc
        return area.latitude_center, area.longitude_center, area.precision_m

    if req.fonte == "endereco":
        if not req.endereco:
            raise NormalizeError("payload_incompleto", "Informe endereco")
        try:
            geo = provider.geocode(req.endereco)
        except GeocodeNotFound as exc:
            # Fallback obrigatório: tenta Plus Code informado junto ao endereço.
            if req.plus_code:
                return _resolver(
                    NormalizeRequest(
                        fonte="plus_code",
                        plus_code=req.plus_code,
                        referencia_lat=req.referencia_lat,
                        referencia_lng=req.referencia_lng,
                        tenant_id=req.tenant_id,
                        operador=req.operador,
                    ),
                    provider,
                )
            raise NormalizeError("endereco_nao_encontrado", str(exc)) from exc
        return geo.lat, geo.lng, geo.precisao_m

    raise NormalizeError("fonte_invalida", f"fonte deve ser uma de {FONTES}")


def normalize(
    req: NormalizeRequest,
    provider: MapProvider,
    repo: LocationRepository | None = None,
    bbox: BoundingBox | None = None,
) -> CanonicalLocation:
    """Normaliza qualquer formato de entrada no registro canônico validado."""
    if req.fonte not in FONTES:
        raise NormalizeError("fonte_invalida", f"fonte deve ser uma de {FONTES}")

    lat, lng, precisao_m = _resolver(req, provider)
    try:
        validar_plausibilidade(lat, lng, precisao_m, bbox)
    except ValidationError as exc:
        raise NormalizeError(exc.motivo, exc.detalhe) from exc

    location = CanonicalLocation(
        lat=round(lat, 7),
        lng=round(lng, 7),
        precisao_m=precisao_m,
        fonte=req.fonte,
        timestamp=_agora(),
        plus_code_equivalente=pluscode.encode(lat, lng),
        validado=True,
    )
    location.auditoria.append(
        AuditRecord(
            quem=req.operador,
            quando=location.timestamp,
            acao="normalizar_localizacao",
            origem=req.fonte,
        )
    )
    if repo is not None:
        repo.salvar(location, req.tenant_id)
    return location
