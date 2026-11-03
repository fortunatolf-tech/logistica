import { test } from "node:test";
import assert from "node:assert/strict";
import { MutationQueue } from "../src/queue.js";
import { InMemoryMutationStorage } from "../src/storage.js";
import { SyncEngine, type Transport } from "../src/sync.js";
import type { Mutation } from "../src/types.js";

class TransportFake implements Transport {
  enviadas: Mutation[] = [];
  falharChaves = new Set<string>();

  async enviar(m: Mutation): Promise<void> {
    if (this.falharChaves.has(m.idempotency_key)) {
      throw new Error("falha de rede simulada");
    }
    this.enviadas.push(m);
  }
}

class OnlineFake {
  private callbacks: Array<() => void> = [];
  addEventListener(_tipo: "online", cb: () => void): void {
    this.callbacks.push(cb);
  }
  disparar(): void {
    for (const cb of this.callbacks) cb();
  }
}

function setup(rand: () => number = () => 0) {
  const queue = new MutationQueue(new InMemoryMutationStorage(), { baseMs: 10, rand });
  const transport = new TransportFake();
  const engine = new SyncEngine(queue, transport);
  return { queue, transport, engine };
}

test("drena a fila em ordem de modificação", async () => {
  const { queue, transport, engine } = setup();
  await queue.enfileirar({ idempotency_key: "a", entidade: "delivery", operacao: "criar", payload: {} });
  await queue.enfileirar({ idempotency_key: "b", entidade: "delivery", operacao: "criar", payload: {} });
  const r = await engine.processar();
  assert.equal(r.enviadas, 2);
  assert.equal(r.falhas, 0);
  assert.deepEqual(transport.enviadas.map((m) => m.idempotency_key), ["a", "b"]);
});

test("falha de rede não interrompe o restante da fila", async () => {
  const { queue, transport, engine } = setup();
  await queue.enfileirar({ idempotency_key: "ok1", entidade: "delivery", operacao: "criar", payload: {} });
  await queue.enfileirar({ idempotency_key: "falha", entidade: "delivery", operacao: "criar", payload: {} });
  await queue.enfileirar({ idempotency_key: "ok2", entidade: "delivery", operacao: "criar", payload: {} });
  transport.falharChaves.add("falha");
  const r = await engine.processar();
  assert.equal(r.enviadas, 2);
  assert.equal(r.falhas, 1);
});

test("exclusão sincronizada é expurgada da fila", async () => {
  const { queue, engine } = setup();
  const storage = (queue as unknown as { storage: InMemoryMutationStorage }).storage;
  await queue.enfileirar({ idempotency_key: "del", entidade: "delivery", operacao: "excluir", payload: { id: "e1" } });
  await engine.processar();
  assert.equal((await storage.todas()).length, 0);
});

test("processar concorrente não duplica envios", async () => {
  const { queue, transport, engine } = setup();
  await queue.enfileirar({ idempotency_key: "x", entidade: "delivery", operacao: "criar", payload: {} });
  await Promise.all([engine.processar(), engine.processar()]);
  assert.equal(transport.enviadas.length, 1);
});

test("evento online dispara sincronização", async () => {
  const { queue, transport, engine } = setup();
  const online = new OnlineFake();
  engine.aoReconectar({ online });
  await queue.enfileirar({ idempotency_key: "y", entidade: "delivery", operacao: "criar", payload: {} });
  online.disparar();
  await new Promise((r) => setImmediate(r));
  assert.equal(transport.enviadas.length, 1);
});

test("registra Background Sync quando disponível", async () => {
  const { engine } = setup();
  const tags: string[] = [];
  const backgroundSync = { register: async (tag: string) => { tags.push(tag); } };
  engine.aoReconectar({ backgroundSync });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(tags, ["rotaviva-sync"]);
});
