"""API HTTP do route-optimizer (FastAPI).

POST /v1/routes/optimize — VRP com janelas de tempo e perfil de veículo
(ver packages/shared-types e docs/openapi/openapi.yaml).
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .cache import cache_from_env, chave_cache, ttl_padrao_s
from .optimizer import StopInput, optimize

app = FastAPI(title="RotaViva — route-optimizer", version="0.1.0")

# REDIS_URL definida → cache compartilhado; caso contrário, memória local.
_cache = cache_from_env()


class Veiculo(BaseModel):
    tipo: str = Field(..., description="moto | carro | van | caminhao")
    capacidade: float = 0


class EntregaIn(BaseModel):
    id: str
    lat: float
    lng: float
    janela_inicio: str | None = None
    janela_fim: str | None = None
    prioridade: int = 0
    servico_min: float = 5.0


class Restricoes(BaseModel):
    areas_restritas: list[str] = Field(default_factory=list)
    horario_operacao: str | None = None


class Origem(BaseModel):
    lat: float
    lng: float


class OptimizeBody(BaseModel):
    tenant_id: str
    veiculo: Veiculo
    entregas: list[EntregaIn]
    restricoes: Restricoes | None = None
    origem: Origem | None = None
    inicio: str | None = None


@app.post("/v1/routes/optimize")
def otimizar(body: OptimizeBody):
    payload = body.model_dump()
    chave = chave_cache(payload)
    em_cache = _cache.get(chave)
    if em_cache is not None:
        return em_cache

    entregas = [
        StopInput(
            id=e.id, lat=e.lat, lng=e.lng,
            janela_inicio=e.janela_inicio, janela_fim=e.janela_fim,
            prioridade=e.prioridade, servico_min=e.servico_min,
        )
        for e in body.entregas
    ]
    try:
        result = optimize(
            tenant_id=body.tenant_id,
            veiculo_tipo=body.veiculo.tipo,
            entregas=entregas,
            origem=(body.origem.lat, body.origem.lng) if body.origem else None,
            inicio=body.inicio,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    resposta = {
        "tenant_id": result.tenant_id,
        "paradas": [
            {
                "id": p.id,
                "sequencia": p.sequencia,
                "lat": p.lat,
                "lng": p.lng,
                "eta": p.eta.isoformat().replace("+00:00", "Z"),
                "distancia_desde_anterior_km": p.distancia_desde_anterior_km,
                "janela_respeitada": p.janela_respeitada,
            }
            for p in result.paradas
        ],
        "metricas": result.metricas,
        "rejeitadas": [vars(r) for r in result.rejeitadas],
    }
    _cache.set(chave, resposta, ttl_padrao_s())
    return resposta


@app.get("/healthz")
def healthz():
    return {"status": "ok", "servico": "route-optimizer"}
