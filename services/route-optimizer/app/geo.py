"""Distâncias geodésicas e matriz de distância com fator de sinuosidade urbana.

A matriz local (Haversine × fator urbano) é o baseline offline; em produção,
o pós-processamento usa a matriz de tempos do MapProvider com trânsito em
tempo real (cache Redis, TTL curto — ver Bloco 3 da especificação).
"""

from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0088

# Fator de sinuosidade: ruas urbanas percorrem ~30% a mais que a linha reta.
URBAN_CIRCUITY_FACTOR = 1.3


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def distancia_urbana_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return haversine_km(lat1, lng1, lat2, lng2) * URBAN_CIRCUITY_FACTOR


def build_matrix(points: list[tuple[float, float]]) -> list[list[float]]:
    """Matriz NxN de distâncias urbanas (km) entre os pontos."""
    n = len(points)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = distancia_urbana_km(points[i][0], points[i][1], points[j][0], points[j][1])
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix
