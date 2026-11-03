/**
 * Tipos do núcleo offline-first (ADR-0003).
 *
 * Toda mutação feita no app passa pela fila local com estes metadados;
 * o servidor recebe `idempotency_key` em todos os endpoints de escrita.
 */

export type SyncStatus = "pendente" | "sincronizando" | "sincronizado" | "erro";

export type Operacao = "criar" | "atualizar" | "excluir";

export interface Mutation<T = Record<string, unknown>> {
  /** Chave de idempotência — o servidor deve deduplicar por ela. */
  idempotency_key: string;
  /** Entidade de domínio: "delivery", "location", etc. */
  entidade: string;
  operacao: Operacao;
  payload: T;
  _syncStatus: SyncStatus;
  /** ISO 8601 da última modificação local. */
  _lastModified: string;
  _localVersion: number;
  /** Tombstone: exclusões ficam registradas até o ack do servidor. */
  _deletedAt: string | null;
  tentativas: number;
  /** ISO 8601 — não tentar antes deste instante (backoff). */
  proximaTentativa: string | null;
}

/** Registro de dados versionado, base para resolução de conflitos. */
export interface RegistroVersionado {
  _lastModified: string;
  _localVersion: number;
  /** Timestamp ISO por campo, para merge em nível de campo. */
  _campoTs?: Record<string, string>;
  [campo: string]: unknown;
}
