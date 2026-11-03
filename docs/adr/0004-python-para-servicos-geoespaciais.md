# ADR 0004 — Python/FastAPI para geo-normalizer e route-optimizer

## Status
Aceito

## Contexto
A stack de referência define Node.js/TypeScript para APIs de domínio e
Python/FastAPI para "o motor de otimização e processamento geoespacial".
O `geo-normalizer` é, ao mesmo tempo, API de domínio e processamento
geoespacial (EXIF, Plus Codes, geocodificação).

## Decisão
`geo-normalizer` e `route-optimizer` em Python 3.12 + FastAPI, com núcleo de
regras em módulos puros (sem framework) para testabilidade. Os demais serviços
de domínio (delivery, matching, analytics) e o API Gateway seguem em
Node.js/TypeScript, compartilhando contratos via `packages/shared-types` e
`docs/openapi/openapi.yaml`.

## Justificativa
- Pillow/EXIF e o ecossistema geoespacial Python são maduros; a biblioteca
  oficial de Open Location Code é referência em Python (aqui reimplementada
  em módulo puro para eliminar dependência e permitir auditoria).
- O núcleo puro permite testes com stdlib `unittest`, sem subir framework.

## Consequências
- Dois runtimes no monorepo (Node e Python): CI com jobs separados.
- Contratos são a fronteira: qualquer divergência entre `shared-types` e os
  schemas Python é bug — testes de contrato entram no pipeline do gateway
  (incremento 3).
