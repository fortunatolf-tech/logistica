-- RotaViva — migração inicial (Bloco 2 item 7, Bloco 5 item 4, Bloco 6 item 4)
-- Requer PostGIS (imagem postgis/postgis:16-3.4).

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Tenants (isolamento lógico por tenant_id em todas as tabelas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        text NOT NULL,
    plano       text NOT NULL DEFAULT 'basico',
    limites     jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Localizações normalizadas (registro canônico + geografia)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants (id),
    lat             double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng             double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
    precisao_m      double precision NOT NULL,
    fonte           text NOT NULL CHECK (fonte IN ('exif', 'gps', 'plus_code', 'endereco')),
    plus_code       text NOT NULL,
    validado        boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    geom            geography(Point, 4326) GENERATED ALWAYS AS
                    (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED
);
CREATE INDEX IF NOT EXISTS locations_geom_idx ON locations USING gist (geom);
CREATE INDEX IF NOT EXISTS locations_tenant_idx ON locations (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Entregas (tombstone via deleted_at; idempotency_key única por tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants (id),
    location_id      uuid REFERENCES locations (id),
    status           text NOT NULL DEFAULT 'criada'
                     CHECK (status IN ('criada','atribuida','em_rota','entregue','falha','cancelada')),
    janela_inicio    timestamptz,
    janela_fim       timestamptz,
    prioridade       integer NOT NULL DEFAULT 0,
    idempotency_key  text NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,          -- tombstone (ADR-0003)
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS deliveries_tenant_status_idx
    ON deliveries (tenant_id, status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Trilha de auditoria imutável (append-only — Bloco 6, item 4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    uuid NOT NULL,
    quem         text NOT NULL,
    quando       timestamptz NOT NULL DEFAULT now(),
    acao         text NOT NULL,
    entidade     text NOT NULL,
    entidade_id  text,
    detalhe      jsonb NOT NULL DEFAULT '{}'
);

CREATE OR REPLACE FUNCTION bloquear_mutacao_audit() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log é append-only: UPDATE/DELETE proibidos';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_imutavel ON audit_log;
CREATE TRIGGER audit_imutavel
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao();

-- ---------------------------------------------------------------------------
-- Solicitações de titular (Bloco 5, item 2; Bloco 6, item 7)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lgpd_requests (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants (id),
    titular_id     text NOT NULL,
    tipo           text NOT NULL CHECK (tipo IN ('acesso','exportacao','eliminacao')),
    status         text NOT NULL DEFAULT 'recebido'
                   CHECK (status IN ('recebido','em_processamento','concluido','recusado')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    processado_em  timestamptz
);

-- ---------------------------------------------------------------------------
-- Row-Level Security: o app define app.tenant_id por conexão
-- (SET LOCAL app.tenant_id = '<uuid>' dentro da transação).
-- ---------------------------------------------------------------------------
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY locations_tenant_isolamento ON locations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY deliveries_tenant_isolamento ON deliveries
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
