# RotaViva

Plataforma de logística urbana e *last mile*: normalização geoespacial multimodal
(EXIF, GPS nativo, Plus Codes, endereço), otimização de rotas com restrições urbanas
e experiência mobile-first offline-first.

Este repositório segue a especificação mestra do produto. Conformidade legal (LGPD)
é premissa de arquitetura, implementada como camada técnica (ver ADRs em `docs/adr/`).

## Estrutura do monorepo

```
rotaviva/
├── apps/
│   ├── web-pwa/                 # PWA mobile-first (entregador, gestor) — React + Vite
│   ├── api-gateway/             # Borda: OAuth2/OIDC, RBAC, MFA, rate limiting, proxy
│   └── admin-console/           # (planejado) Console administrativo e DPO
├── services/
│   ├── geo-normalizer/          # Normalização multimodal — FastAPI (Python)
│   ├── route-optimizer/         # Motor VRP + restrições — FastAPI (Python)
│   ├── delivery-service/        # (planejado)
│   ├── matching-service/        # (planejado)
│   └── analytics-service/       # (planejado)
├── packages/
│   ├── shared-types/            # Contratos TypeScript canônicos
│   ├── offline-core/            # Núcleo offline-first (fila, backoff, conflitos, sync)
│   ├── ui-components/           # Design system reutilizável (WCAG 2.2 AA)
│   └── sdk-client/              # (planejado — gerado a partir do OpenAPI)
├── infra/
│   └── docker/                  # Dockerfiles dos serviços
└── docs/
    ├── openapi/openapi.yaml     # Contratos de API (OpenAPI 3.1)
    └── adr/                     # Architecture Decision Records
```

Decisão de linguagem (ADR-0004): `geo-normalizer` e `route-optimizer` são Python/FastAPI
(processamento geoespacial e motor de otimização); APIs de domínio (delivery, matching,
analytics, gateway) serão Node.js/TypeScript conforme a especificação.

## Como executar

### Infraestrutura local (Postgres+PostGIS, Redis, MinIO, RabbitMQ)

```bash
cp .env.example .env
docker compose up -d postgres redis minio rabbitmq
```

### Serviços em container

```bash
docker compose up -d --build geo-normalizer route-optimizer
# geo-normalizer:  http://localhost:8001/docs
# route-optimizer: http://localhost:8002/docs
```

### Desenvolvimento local (sem Docker)

```bash
cd services/geo-normalizer
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Testes

```bash
cd services/geo-normalizer && python -m unittest discover -s tests -v
cd services/route-optimizer && python -m unittest discover -s tests -v
```

## Incrementos entregues

| Incremento | Conteúdo | Status |
|---|---|---|
| 1 | Monorepo, `shared-types`, `geo-normalizer` (4 formatos), `route-optimizer` (VRP + janelas), OpenAPI, ADRs, CI | ✅ entregue |
| 2 | `offline-core` (fila, backoff, conflitos), `ui-components` (7 componentes), `web-pwa` (7 telas, SW, offline-first) | ✅ entregue |
| 3 | `api-gateway` (OIDC, RBAC, MFA, rate limiting), schema PostGIS (audit append-only, RLS), persistência e cache Redis nos serviços | ✅ entregue |
| 4 | Conectores (e-commerce sandbox, TMS/ERP), webhooks HMAC | planejado |
| 5 | Analytics, dashboards por perfil, central do titular | planejado |

### PWA (desenvolvimento)

```bash
npm install
npm run dev -w @rotaviva/web-pwa        # http://localhost:5173 (proxy para os serviços)
npm test -w @rotaviva/offline-core      # testes do núcleo offline (node:test)
npm run build -w @rotaviva/web-pwa      # build de produção com code splitting
```
