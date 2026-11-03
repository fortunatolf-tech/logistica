"""Validação de coordenadas e plausibilidade geográfica por tenant."""

from __future__ import annotations

import os
from dataclasses import dataclass


class ValidationError(ValueError):
    """Coordenada ou precisão fora dos limites aceitáveis."""

    def __init__(self, motivo: str, detalhe: str = ""):
        super().__init__(f"{motivo}: {detalhe}" if detalhe else motivo)
        self.motivo = motivo
        self.detalhe = detalhe


@dataclass(frozen=True)
class BoundingBox:
    """min_lng, min_lat, max_lng, max_lat."""

    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float

    def contem(self, lat: float, lng: float) -> bool:
        return self.min_lat <= lat <= self.max_lat and self.min_lng <= lng <= self.max_lng


def bbox_padrao() -> BoundingBox:
    """Bounding box padrão de operação (Brasil), sobrescrevível por env."""
    raw = os.environ.get("OPERATION_BBOX", "-73.99,-33.75,-28.84,5.27")
    min_lng, min_lat, max_lng, max_lat = (float(p) for p in raw.split(","))
    return BoundingBox(min_lng, min_lat, max_lng, max_lat)


def precisao_minima_m() -> float:
    return float(os.environ.get("PRECISION_MIN_M", "100"))


def validar_coordenadas(lat: float, lng: float) -> None:
    if not (-90.0 <= lat <= 90.0):
        raise ValidationError("coordenada_invalida", f"lat fora de [-90, 90]: {lat}")
    if not (-180.0 <= lng <= 180.0):
        raise ValidationError("coordenada_invalida", f"lng fora de [-180, 180]: {lng}")


def validar_plausibilidade(
    lat: float, lng: float, precisao_m: float, bbox: BoundingBox | None = None
) -> None:
    """Rejeita pontos fora da área de operação ou com precisão insuficiente."""
    validar_coordenadas(lat, lng)
    area = bbox or bbox_padrao()
    if not area.contem(lat, lng):
        raise ValidationError(
            "fora_da_area_operacao",
            f"({lat}, {lng}) fora de {area}",
        )
    limite = precisao_minima_m()
    if precisao_m > limite:
        raise ValidationError(
            "precisao_insuficiente",
            f"precisao {precisao_m:.0f} m acima do limite de {limite:.0f} m",
        )
