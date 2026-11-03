import type { Mutation } from "./types.js";

/**
 * Porta de persistência da fila de mutações.
 * Implementações: IndexedDB no app (idb), memória em testes.
 */
export interface MutationStorage {
  put(m: Mutation): Promise<void>;
  get(idempotencyKey: string): Promise<Mutation | undefined>;
  /** Mutações elegíveis para envio agora (status pendente/erro e backoff vencido). */
  pendentes(agora?: Date): Promise<Mutation[]>;
  remover(idempotencyKey: string): Promise<void>;
  todas(): Promise<Mutation[]>;
}

export class InMemoryMutationStorage implements MutationStorage {
  private mapa = new Map<string, Mutation>();

  async put(m: Mutation): Promise<void> {
    this.mapa.set(m.idempotency_key, m);
  }

  async get(idempotencyKey: string): Promise<Mutation | undefined> {
    return this.mapa.get(idempotencyKey);
  }

  async pendentes(agora: Date = new Date()): Promise<Mutation[]> {
    const iso = agora.toISOString();
    return [...this.mapa.values()]
      .filter(
        (m) =>
          (m._syncStatus === "pendente" || m._syncStatus === "erro") &&
          (m.proximaTentativa === null || m.proximaTentativa <= iso),
      )
      .sort((a, b) => a._lastModified.localeCompare(b._lastModified));
  }

  async remover(idempotencyKey: string): Promise<void> {
    this.mapa.delete(idempotencyKey);
  }

  async todas(): Promise<Mutation[]> {
    return [...this.mapa.values()];
  }
}
