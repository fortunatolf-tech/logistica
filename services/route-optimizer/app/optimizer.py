"""Motor de otimização de rotas (VRP com janelas de tempo).

Pipeline (Bloco 3 da especificação):
  1. Validação e rejeição estruturada (coordenada inválida, janela impossível).
  2. Agrupamento espacial (K-Means, semente fixa) para instâncias grandes.
  3. Sequenciamento por vizinho mais próximo + refinamento 2-opt por cluster.
  4. Agenda com janelas de tempo, tempos de serviço e perfil do veículo.
  5. Métricas: tempo, distância, combustível estimado e aderência às janelas.

Puro Python (stdlib): o módulo é testável sem FastAPI, numpy ou rede.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .geo import build_matrix

# ---------------------------------------------------------------------------
# Perfis de veículo: velocidade média urbana e consumo estimado.
# ---------------------------------------------------------------------------

VEHICLE_PROFILES: dict[str, dict[str, float]] = {
    "moto": {"vel_kmh": 30.0, "l_por_km": 0.035},
    "carro": {"vel_kmh": 28.0, "l_por_km": 0.090},
    "van": {"vel_kmh": 26.0, "l_por_km": 0.130},
    "caminhao": {"vel_kmh": 24.0, "l_por_km": 0.300},
}

# Acima deste número de paradas, a instância é dividida por K-Means.
CLUSTER_MAX = 25
SERVICO_PADRAO_MIN = 5.0


@dataclass
class StopInput:
    id: str
    lat: float
    lng: float
    janela_inicio: datetime | None = None
    janela_fim: datetime | None = None
    prioridade: int = 0
    servico_min: float = SERVICO_PADRAO_MIN


@dataclass
class RouteStop:
    id: str
    sequencia: int
    lat: float
    lng: float
    eta: datetime
    distancia_desde_anterior_km: float
    janela_respeitada: bool


@dataclass
class RejectedDelivery:
    id: str
    motivo: str
    detalhe: str = ""


@dataclass
class OptimizeResult:
    tenant_id: str
    paradas: list[RouteStop] = field(default_factory=list)
    metricas: dict[str, float] = field(default_factory=dict)
    rejeitadas: list[RejectedDelivery] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Agrupamento espacial (K-Means, semente fixa para determinismo)
# ---------------------------------------------------------------------------

def _kmeans(points: list[tuple[float, float]], k: int, seed: int = 42,
            iters: int = 60) -> list[list[int]]:
    """Retorna lista de clusters, cada um com índices dos pontos."""
    n = len(points)
    if k >= n:
        return [[i] for i in range(n)]
    rng = random.Random(seed)
    centroids = [points[i] for i in rng.sample(range(n), k)]
    assignment = [0] * n
    for _ in range(iters):
        changed = False
        for i, p in enumerate(points):
            best = min(range(k), key=lambda c: (p[0] - centroids[c][0]) ** 2
                       + (p[1] - centroids[c][1]) ** 2)
            if best != assignment[i]:
                assignment[i] = best
                changed = True
        new_centroids = []
        for c in range(k):
            members = [points[i] for i in range(n) if assignment[i] == c]
            if members:
                new_centroids.append((
                    sum(p[0] for p in members) / len(members),
                    sum(p[1] for p in members) / len(members),
                ))
            else:
                new_centroids.append(centroids[c])
        centroids = new_centroids
        if not changed:
            break
    clusters: list[list[int]] = [[] for _ in range(k)]
    for i, c in enumerate(assignment):
        clusters[c].append(i)
    return [c for c in clusters if c]


# ---------------------------------------------------------------------------
# Sequenciamento: vizinho mais próximo + 2-opt (rota aberta a partir do depósito)
# ---------------------------------------------------------------------------

def _nearest_neighbor(indices: list[int], dist: list[list[float]],
                      depot: int) -> list[int]:
    remaining = set(indices)
    route: list[int] = []
    current = depot
    while remaining:
        nxt = min(remaining, key=lambda i: dist[current][i])
        route.append(nxt)
        remaining.discard(nxt)
        current = nxt
    return route


def _two_opt(seq: list[int], dist: list[list[float]], max_passes: int = 50) -> list[int]:
    """2-opt em rota aberta; seq[0] é o depósito e permanece fixo."""
    n = len(seq)
    if n < 4:
        return seq
    for _ in range(max_passes):
        improved = False
        for i in range(1, n - 1):
            a, b = seq[i - 1], seq[i]
            for j in range(i + 1, n):
                c = seq[j]
                d = seq[j + 1] if j + 1 < n else None
                before = dist[a][b] + (dist[c][d] if d is not None else 0.0)
                after = dist[a][c] + (dist[b][d] if d is not None else 0.0)
                if after < before - 1e-9:
                    seq[i:j + 1] = reversed(seq[i:j + 1])
                    improved = True
        if not improved:
            break
    return seq


# ---------------------------------------------------------------------------
# Otimização principal
# ---------------------------------------------------------------------------

def _parse_dt(value: datetime | str | None) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def optimize(
    tenant_id: str,
    veiculo_tipo: str,
    entregas: list[StopInput],
    origem: tuple[float, float] | None = None,
    inicio: datetime | str | None = None,
) -> OptimizeResult:
    if veiculo_tipo not in VEHICLE_PROFILES:
        raise ValueError(
            f"veiculo_incompativel: tipo deve ser um de {sorted(VEHICLE_PROFILES)}"
        )
    perfil = VEHICLE_PROFILES[veiculo_tipo]
    t0 = _parse_dt(inicio) or datetime.now(timezone.utc)
    result = OptimizeResult(tenant_id=tenant_id)

    # 1) Validação e rejeições estruturadas.
    validas: list[StopInput] = []
    for e in entregas:
        if not (-90.0 <= e.lat <= 90.0) or not (-180.0 <= e.lng <= 180.0):
            result.rejeitadas.append(RejectedDelivery(
                e.id, "coordenada_invalida", f"({e.lat}, {e.lng})"))
            continue
        e.janela_inicio = _parse_dt(e.janela_inicio)
        e.janela_fim = _parse_dt(e.janela_fim)
        if e.janela_fim is not None and e.janela_fim <= t0:
            result.rejeitadas.append(RejectedDelivery(
                e.id, "janela_impossivel",
                f"janela_fim {e.janela_fim.isoformat()} anterior ao início da rota"))
            continue
        if (e.janela_inicio is not None and e.janela_fim is not None
                and e.janela_inicio >= e.janela_fim):
            result.rejeitadas.append(RejectedDelivery(
                e.id, "janela_impossivel", "janela_inicio >= janela_fim"))
            continue
        validas.append(e)

    if not validas:
        result.metricas = _metricas(0.0, 0.0, 0.0, perfil, 0, 0)
        return result

    # 2) Depósito: origem informada ou centroide das entregas.
    depot = origem or (
        sum(e.lat for e in validas) / len(validas),
        sum(e.lng for e in validas) / len(validas),
    )
    points = [depot] + [(e.lat, e.lng) for e in validas]  # índice 0 = depósito
    dist = build_matrix(points)
    indices = list(range(1, len(points)))

    # 3) Agrupamento espacial para instâncias grandes.
    if len(indices) > CLUSTER_MAX:
        k = -(-len(indices) // CLUSTER_MAX)  # ceil
        stop_points = [points[i] for i in indices]
        clusters = [[indices[m] for m in cluster]
                    for cluster in _kmeans(stop_points, k)]
        # Ordena clusters pela distância do seu ponto mais próximo ao depósito.
        clusters.sort(key=lambda c: min(dist[0][i] for i in c))
    else:
        clusters = [indices]

    # 4) Sequenciamento por cluster: NN + 2-opt.
    ordem_global: list[int] = []
    for cluster in clusters:
        rota = _nearest_neighbor(cluster, dist, 0)
        rota = _two_opt([0] + rota, dist)[1:]
        ordem_global.extend(rota)

    # 5) Agenda com janelas, serviço e métricas.
    relogio = t0
    anterior = 0
    distancia_total = 0.0
    com_janela = 0
    respeitadas = 0
    for seq, idx in enumerate(ordem_global, start=1):
        stop = validas[idx - 1]
        trecho = dist[anterior][idx]
        distancia_total += trecho
        chegada = relogio + timedelta(hours=trecho / perfil["vel_kmh"])
        janela_ok = True
        if stop.janela_fim is not None or stop.janela_inicio is not None:
            com_janela += 1
            if stop.janela_fim is not None and chegada > stop.janela_fim:
                janela_ok = False
            else:
                respeitadas += 1
        inicio_servico = (
            max(chegada, stop.janela_inicio)
            if stop.janela_inicio is not None else chegada
        )
        result.paradas.append(RouteStop(
            id=stop.id,
            sequencia=seq,
            lat=stop.lat,
            lng=stop.lng,
            eta=chegada,
            distancia_desde_anterior_km=round(trecho, 3),
            janela_respeitada=janela_ok,
        ))
        relogio = inicio_servico + timedelta(minutes=stop.servico_min)
        anterior = idx

    tempo_total_min = (relogio - t0).total_seconds() / 60.0
    result.metricas = _metricas(
        distancia_total, tempo_total_min, tempo_total_min, perfil,
        com_janela, respeitadas,
    )
    return result


def _metricas(distancia_km: float, tempo_min: float, _tempo: float,
              perfil: dict[str, float], com_janela: int,
              respeitadas: int) -> dict[str, float]:
    aderencia = (respeitadas / com_janela * 100.0) if com_janela else 100.0
    return {
        "tempo_total_estimado_min": round(tempo_min, 1),
        "distancia_total_km": round(distancia_km, 2),
        "combustivel_estimado_l": round(distancia_km * perfil["l_por_km"], 2),
        "aderencia_janelas_pct": round(aderencia, 1),
    }
