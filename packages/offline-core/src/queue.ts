import { backoffMs, type BackoffOptions } from "./backoff.js";
import type { MutationStorage } from "./storage.js";
import type { Mutation, Operacao } from "./types.js";

export interface NovaMutacao<T = Record<string, unknown>> {
  idempotency_key: string;
  entidade: string;
  operacao: Operacao;
  payload: T;
}

export interface QueueOptions extends BackoffOptions {
  maxTentativas?: number;
  agora?: () => Date;
}

/**
 * Fila de mutações offline (ADR-0003).
 *
 * - `enfileirar` é idempotente: mesma `idempotency_key` não duplica entradas;
 * - exclusões viram tombstones (`_deletedAt`) e só são expurgadas após o ack;
 * - falhas agendam `proximaTentativa` com backoff exponencial + jitter;
 * - após `maxTentativas`, a mutação vai para `erro` (visível na UI).
 */
export class MutationQueue {
  private readonly storage: MutationStorage;
  private readonly maxTentativas: number;
  private readonly backoff: BackoffOptions;
  private readonly agora: () => Date;

  constructor(storage: MutationStorage, opts: QueueOptions = {}) {
    this.storage = storage;
    this.maxTentativas = opts.maxTentativas ?? 8;
    this.backoff = opts;
    this.agora = opts.agora ?? (() => new Date());
  }

  async enfileirar<T extends Record<string, unknown>>(
    nova: NovaMutacao<T>,
  ): Promise<Mutation<T>> {
    const existente = await this.storage.get(nova.idempotency_key);
    if (existente) {
      // Idempotência: reenvio da mesma chave não duplica a fila.
      return existente as Mutation<T>;
    }
    const agoraIso = this.agora().toISOString();
    const mutacao: Mutation<T> = {
      ...nova,
      _syncStatus: "pendente",
      _lastModified: agoraIso,
      _localVersion: 1,
      _deletedAt: nova.operacao === "excluir" ? agoraIso : null,
      tentativas: 0,
      proximaTentativa: null,
    };
    await this.storage.put(mutacao as Mutation);
    return mutacao;
  }

  async pendentes(): Promise<Mutation[]> {
    return this.storage.pendentes(this.agora());
  }

  async marcarSincronizando(key: string): Promise<void> {
    const m = await this.storage.get(key);
    if (!m) return;
    m._syncStatus = "sincronizando";
    await this.storage.put(m);
  }

  /** Ack do servidor: tombstones são expurgados; demais viram "sincronizado". */
  async marcarSincronizada(key: string): Promise<void> {
    const m = await this.storage.get(key);
    if (!m) return;
    if (m._deletedAt !== null) {
      await this.storage.remover(key);
      return;
    }
    m._syncStatus = "sincronizado";
    m.proximaTentativa = null;
    await this.storage.put(m);
  }

  /** Falha de envio: incrementa tentativas e agenda a próxima com backoff. */
  async registrarFalha(key: string): Promise<Mutation | undefined> {
    const m = await this.storage.get(key);
    if (!m) return undefined;
    m.tentativas += 1;
    if (m.tentativas >= this.maxTentativas) {
      m._syncStatus = "erro";
      m.proximaTentativa = null;
    } else {
      m._syncStatus = "pendente";
      const espera = backoffMs(m.tentativas, this.backoff);
      m.proximaTentativa = new Date(this.agora().getTime() + espera).toISOString();
    }
    await this.storage.put(m);
    return m;
  }
}
