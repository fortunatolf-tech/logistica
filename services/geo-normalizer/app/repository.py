"""Persistência do registro canônico no PostGIS, com fallback em memória.

Quando DATABASE_URL está definida, grava `locations` + trilha em `audit_log`
na mesma transação. Sem banco configurado (desenvolvimento/testes), usa o
repositório em memória — a porta `LocationRepository` é a mesma.
"""

from __future__ import annotations

import os

from .normalizer import (
    CanonicalLocation,
    InMemoryLocationRepository,
    LocationRepository,
)


class PostgresLocationRepository:
    """Grava o registro normalizado e a trilha de auditoria em uma transação."""

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._tenant_cache: dict[str, str] = {}

    def salvar(self, location: CanonicalLocation, tenant_id: str) -> None:
        import psycopg  # import tardio: testes não dependem de banco

        with psycopg.connect(self._dsn) as conn:
            with conn.transaction():
                tenant_uuid = self._tenant_uuid(conn, tenant_id)
                # RLS: isola a transação ao tenant corrente.
                conn.execute(
                    "SELECT set_config('app.tenant_id', %s, true)", (tenant_uuid,)
                )
                conn.execute(
                    """
                    INSERT INTO locations
                        (id, tenant_id, lat, lng, precisao_m, fonte, plus_code,
                         validado, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        location.id,
                        tenant_uuid,
                        location.lat,
                        location.lng,
                        location.precisao_m,
                        location.fonte,
                        location.plus_code_equivalente,
                        location.validado,
                        location.timestamp,
                    ),
                )
                for audit in location.auditoria:
                    conn.execute(
                        """
                        INSERT INTO audit_log
                            (tenant_id, quem, quando, acao, entidade, entidade_id)
                        VALUES (%s, %s, %s, %s, 'location', %s)
                        """,
                        (
                            tenant_uuid,
                            audit.quem,
                            audit.quando,
                            audit.acao,
                            location.id,
                        ),
                    )

    def _tenant_uuid(self, conn, slug: str) -> str:
        """Resolve (ou cria) o tenant pelo slug; cache em memória."""
        if slug in self._tenant_cache:
            return self._tenant_cache[slug]
        row = conn.execute(
            "SELECT id FROM tenants WHERE nome = %s", (slug,)
        ).fetchone()
        if row is None:
            row = conn.execute(
                "INSERT INTO tenants (nome) VALUES (%s) RETURNING id", (slug,)
            ).fetchone()
        uuid = str(row[0])
        self._tenant_cache[slug] = uuid
        return uuid


def repository_from_env() -> LocationRepository:
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return PostgresLocationRepository(dsn)
    return InMemoryLocationRepository()
