import { MutationQueue, type QueueOptions } from "./queue.js";
import type { Mutation } from "./types.js";

/**
 * Motor de sincronização: drena a fila local para o servidor.
 *
 * Gatilhos (ADR-0003): Background Sync API como otimização e listener de
 * `online` como garantia — ambos injetáveis para testabilidade.
 */

export interface Transport {
  /** Envia a mutação ao servidor; rejeita a promise em caso de falha. */
  enviar(m: Mutation): Promise<void>;
}

/** Mínimo de EventTarget necessário — window no navegador, fake em testes. */
export interface OnlineEventSource {
  addEventListener(tipo: "online", callback: () => void): void;
}

export interface BackgroundSyncRegistration {
  register(tag: string): Promise<unknown>;
}

export interface SyncEventos {
  online?: OnlineEventSource;
  backgroundSync?: BackgroundSyncRegistration;
}

export interface SyncResultado {
  enviadas: number;
  falhas: number;
}

export class SyncEngine {
  private readonly fila: MutationQueue;
  private readonly transport: Transport;
  private emAndamento = false;

  constructor(
    fila: MutationQueue,
    transport: Transport,
    _opts: QueueOptions = {},
  ) {
    this.fila = fila;
    this.transport = transport;
  }

  /** Processa a fila em ordem de modificação; nunca executa em paralelo. */
  async processar(): Promise<SyncResultado> {
    if (this.emAndamento) return { enviadas: 0, falhas: 0 };
    this.emAndamento = true;
    const resultado: SyncResultado = { enviadas: 0, falhas: 0 };
    try {
      for (const m of await this.fila.pendentes()) {
        await this.fila.marcarSincronizando(m.idempotency_key);
        try {
          await this.transport.enviar(m);
          await this.fila.marcarSincronizada(m.idempotency_key);
          resultado.enviadas += 1;
        } catch {
          await this.fila.registrarFalha(m.idempotency_key);
          resultado.falhas += 1;
        }
      }
    } finally {
      this.emAndamento = false;
    }
    return resultado;
  }

  /**
   * Liga os gatilhos de sincronização: Background Sync API quando disponível
   * e listener de `online` como garantia mínima.
   */
  aoReconectar(eventos: SyncEventos): void {
    const disparar = () => {
      void this.processar();
    };
    eventos.online?.addEventListener("online", disparar);
    if (eventos.backgroundSync) {
      void eventos.backgroundSync.register("rotaviva-sync").catch(() => {
        // Background Sync indisponível: o listener de `online` já cobre.
      });
    }
  }
}
