# ADR 0003 — Estratégia offline-first do PWA

## Status
Aceito (implementação no incremento do `web-pwa`)

## Contexto
O entregador opera em campo, frequentemente sem conexão (garagens, túneis,
áreas rurais). A confirmação de entrega não pode depender de rede.

## Decisão
1. Toda leitura e escrita do app passa pelo IndexedDB local (biblioteca `idb`).
2. Mutações entram numa fila com `idempotency_key`, `_syncStatus`,
   `_lastModified`, `_localVersion`; exclusões são tombstones (`_deletedAt`).
3. Sincronização com backoff exponencial + jitter; Background Sync API como
   otimização e listener de `online` como garantia mínima.
4. Resolução de conflitos: last-write-wins para status de entrega;
   merge por campo para localização (o servidor re-normaliza via
   geo-normalizer ao receber).

## Consequências
- O servidor precisa tratar `idempotency_key` em todos os endpoints de escrita
  (já previsto no contrato de `POST /v1/deliveries`).
- Tombstones exigem varredura periódica de expurgo (job de retenção, ligado à
  política de retenção configurável do Bloco 6).
- Testes E2E obrigatórios do fluxo offline → reconexão → sincronização
  (Playwright), com Lighthouse ≥ 90.
