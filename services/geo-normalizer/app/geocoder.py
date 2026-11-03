"""Abstração de provedor de mapas/geocodificação (ADR-0002).

O serviço nunca fala diretamente com um provedor específico: depende apenas
da interface `MapProvider`. A troca de provedor é feita por configuração
(variável de ambiente MAP_PROVIDER).
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class GeocodeResult:
    lat: float
    lng: float
    precisao_m: float
    endereco_formatado: str
    provedor: str


class GeocodeNotFound(ValueError):
    """Endereço não encontrado pelo geocodificador."""


class MapProvider(Protocol):
    def geocode(self, endereco: str) -> GeocodeResult: ...


class NominatimProvider:
    """Geocodificação via Nominatim (OpenStreetMap)."""

    def __init__(self, base_url: str | None = None, timeout_s: float = 5.0):
        self.base_url = (base_url or os.environ.get("NOMINATIM_URL")
                         or "https://nominatim.openstreetmap.org").rstrip("/")
        self.timeout_s = timeout_s

    def geocode(self, endereco: str) -> GeocodeResult:
        query = urllib.parse.urlencode(
            {"q": endereco, "format": "json", "limit": 1, "addressdetails": 0}
        )
        request = urllib.request.Request(
            f"{self.base_url}/search?{query}",
            headers={"User-Agent": "rotaviva-geo-normalizer/0.1"},
        )
        with urllib.request.urlopen(request, timeout=self.timeout_s) as resp:
            results = json.loads(resp.read().decode("utf-8"))
        if not results:
            raise GeocodeNotFound(f"Endereço não encontrado: {endereco!r}")
        hit = results[0]
        # Nominatim não informa precisão: usamos a categoria do resultado como proxy.
        tipo = hit.get("addresstype") or hit.get("type") or ""
        precisao_m = 25.0 if tipo in ("house", "building") else 250.0
        return GeocodeResult(
            lat=float(hit["lat"]),
            lng=float(hit["lon"]),
            precisao_m=precisao_m,
            endereco_formatado=hit.get("display_name", endereco),
            provedor="nominatim",
        )


class StaticProvider:
    """Provedor determinístico para sandbox e testes (sem rede)."""

    def __init__(self, tabela: dict[str, GeocodeResult] | None = None):
        self.tabela = {k.lower(): v for k, v in (tabela or {}).items()}

    def geocode(self, endereco: str) -> GeocodeResult:
        hit = self.tabela.get(endereco.strip().lower())
        if hit is None:
            raise GeocodeNotFound(f"Endereço não encontrado: {endereco!r}")
        return hit


def provider_from_env() -> MapProvider:
    nome = os.environ.get("MAP_PROVIDER", "nominatim").lower()
    if nome == "nominatim":
        return NominatimProvider()
    raise ValueError(f"MAP_PROVIDER não suportado neste incremento: {nome!r}")
