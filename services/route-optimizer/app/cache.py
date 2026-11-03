"""Cache TTL para resultados de otimização (Bloco 3, item 6).

Redis quando REDIS_URL está configurada; caso contrário, cache em memória
no processo. A chave é o hash canônico do payload da requisição.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any, Protocol


class TtlCache(Protocol):
    def get(self, chave: str) -> Any | None: ...
    def set(self, chave: str, valor: Any, ttl_s: int) -> None: ...


class InMemoryTtlCache:
    """Cache em memória com expiração — padrão em desenvolvimento e testes."""

    def __init__(self, agora=time.monotonic) -> None:
        self._itens: dict[str, tuple[float, Any]] = {}
        self._agora = agora

    def get(self, chave: str) -> Any | None:
        item = self._itens.get(chave)
        if item is None:
            return None
        expira_em, valor = item
        if self._agora() >= expira_em:
            del self._itens[chave]
            return None
        return valor

    def set(self, chave: str, valor: Any, ttl_s: int) -> None:
        self._itens[chave] = (self._agora() + ttl_s, valor)


class RedisTtlCache:
    """Cache Redis — compartilhado entre réplicas do serviço."""

    def __init__(self, url: str) -> None:
        import redis  # import tardio: testes não dependem do servidor

        self._client = redis.Redis.from_url(url)

    def get(self, chave: str) -> Any | None:
        bruto = self._client.get(f"rotaviva:cache:{chave}")
        return json.loads(bruto) if bruto is not None else None

    def set(self, chave: str, valor: Any, ttl_s: int) -> None:
        self._client.setex(f"rotaviva:cache:{chave}", ttl_s, json.dumps(valor))


def cache_from_env() -> TtlCache:
    url = os.environ.get("REDIS_URL")
    if url:
        return RedisTtlCache(url)
    return InMemoryTtlCache()


def ttl_padrao_s() -> int:
    return int(os.environ.get("MATRIX_CACHE_TTL_S", "120"))


def chave_cache(payload: dict[str, Any]) -> str:
    """Hash estável do payload (ordenação de chaves, sem ruído)."""
    canonico = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonico.encode("utf-8")).hexdigest()
