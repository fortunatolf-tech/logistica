/**
 * Ligação do núcleo offline ao app: fila + transporte HTTP + gatilhos de sync.
 */
import {
  MutationQueue,
  SyncEngine,
  type Mutation,
  type Transport,
} from "@rotaviva/offline-core";
import { IdbMutationStorage } from "./db/idb-storage";

const ENDPOINTS: Record<string, string> = {
  delivery: "/v1/deliveries",
  location: "/v1/locations/normalize",
};

function transporteHttp(): Transport {
  return {
    async enviar(m: Mutation): Promise<void> {
      const base = ENDPOINTS[m.entidade] ?? "/v1/sync";
      const resp = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m.payload, idempotency_key: m.idempotency_key }),
      });
      // 4xx de validação não adianta tentar de novo; 5xx/rede entra no backoff.
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 409) return;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    },
  };
}

export interface ClienteOffline {
  fila: MutationQueue;
  engine: SyncEngine;
}

export async function criarClienteOffline(): Promise<ClienteOffline> {
  const storage = await IdbMutationStorage.criar();
  const fila = new MutationQueue(storage);
  const engine = new SyncEngine(fila, transporteHttp());

  // Garantia mínima: listener de `online`.
  engine.aoReconectar({ online: window });

  // Otimização: Background Sync API quando disponível.
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const syncManager = (reg as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    }).sync;
    if (syncManager) {
      engine.aoReconectar({ backgroundSync: syncManager });
    }
    // O SW repassa o evento de Background Sync para cá.
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.tipo === "rotaviva-sync") void engine.processar();
    });
  }

  return { fila, engine };
}
