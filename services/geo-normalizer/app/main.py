"""API HTTP do geo-normalizer (FastAPI).

POST /v1/locations/normalize — aceita um dos quatro formatos e retorna o
registro canônico (ver packages/shared-types e docs/openapi/openapi.yaml).
"""

from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from .geocoder import MapProvider, provider_from_env
from .normalizer import (
    NormalizeError,
    NormalizeRequest,
    normalize,
)
from .repository import repository_from_env
from .validation import bbox_padrao

app = FastAPI(title="RotaViva — geo-normalizer", version="0.1.0")

# DATABASE_URL definida → PostGIS; caso contrário, memória (dev/testes).
_repository = repository_from_env()


class NormalizeBody(BaseModel):
    fonte: str = Field(..., description="exif | gps | plus_code | endereco")
    lat: float | None = None
    lng: float | None = None
    precisao_m: float | None = None
    foto_base64: str | None = None
    plus_code: str | None = None
    referencia_lat: float | None = None
    referencia_lng: float | None = None
    endereco: str | None = None
    tenant_id: str = "default"
    operador: str = "anonimo"


def get_provider() -> MapProvider:
    return provider_from_env()


@app.post("/v1/locations/normalize", status_code=201)
def normalizar(body: NormalizeBody, provider: MapProvider = Depends(get_provider)):
    req = NormalizeRequest(**body.model_dump())
    try:
        location = normalize(req, provider, repo=_repository, bbox=bbox_padrao())
    except NormalizeError as exc:
        status = 422 if exc.motivo in {
            "coordenada_invalida",
            "fora_da_area_operacao",
            "precisao_insuficiente",
        } else 400
        raise HTTPException(
            status_code=status,
            detail={"motivo": exc.motivo, "detalhe": exc.detalhe},
        ) from exc
    return location.to_dict()


@app.get("/healthz")
def healthz():
    return {"status": "ok", "servico": "geo-normalizer"}
