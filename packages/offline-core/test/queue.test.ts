import { test } from "node:test";
import assert from "node:assert/strict";
import { MutationQueue } from "../src/queue.js";
import { InMemoryMutationStorage } from "../src/storage.js";

const AGORA = new Date("2026-11-03T12:00:00Z");
const agoraFixo = () => new Date(AGORA);

test("enfileirar cria mutação com metadados offline", async () => {
  const queue = new MutationQueue(new InMemoryMutationStorage(), { agora: agoraFixo });
  const m = await queue.enfileirar({
    idempotency_key: "k1",
    entidade: "delivery",
    operacao: "atualizar",
    payload: { status: "entregue" },
  });
  assert.equal(m._syncStatus, "pendente");
  assert.equal(m._lastModified, AGORA.toISOString());
  assert.equal(m._localVersion, 1);
  assert.equal(m._deletedAt, null);
  assert.equal(m.tentativas, 0);
});

test("mesma idempotency_key não duplica a fila", async () => {
  const storage = new InMemoryMutationStorage();
  const queue = new MutationQueue(storage, { agora: agoraFixo });
  await queue.enfileirar({ idempotency_key: "k1", entidade: "delivery", operacao: "criar", payload: {} });
  await queue.enfileirar({ idempotency_key: "k1", entidade: "delivery", operacao: "criar", payload: {} });
  assert.equal((await storage.todas()).length, 1);
});

test("exclusão vira tombstone e é expurgada após o ack", async () => {
  const storage = new InMemoryMutationStorage();
  const queue = new MutationQueue(storage, { agora: agoraFixo });
  const m = await queue.enfileirar({
    idempotency_key: "k-del",
    entidade: "delivery",
    operacao: "excluir",
    payload: { id: "e1" },
  });
  assert.notEqual(m._deletedAt, null);
  assert.equal(m._syncStatus, "pendente"); // ainda precisa ir ao servidor
  await queue.marcarSincronizada("k-del");
  assert.equal((await storage.todas()).length, 0); // expurgada
});

test("atualização sincronizada permanece como histórico", async () => {
  const storage = new InMemoryMutationStorage();
  const queue = new MutationQueue(storage, { agora: agoraFixo });
  await queue.enfileirar({ idempotency_key: "k2", entidade: "delivery", operacao: "atualizar", payload: {} });
  await queue.marcarSincronizada("k2");
  const m = await storage.get("k2");
  assert.equal(m?._syncStatus, "sincronizado");
});

test("falha agenda próxima tentativa com backoff", async () => {
  const queue = new MutationQueue(new InMemoryMutationStorage(), {
    agora: agoraFixo,
    baseMs: 1000,
    rand: () => 0,
  });
  await queue.enfileirar({ idempotency_key: "k3", entidade: "delivery", operacao: "criar", payload: {} });
  const m = await queue.registrarFalha("k3");
  assert.equal(m?.tentativas, 1);
  // backoff(1) com jitter 0 = 1000 ms → próxima tentativa 1 s depois
  assert.equal(m?.proximaTentativa, "2026-11-03T12:00:01.000Z");
  assert.equal(m?._syncStatus, "pendente");
});

test("mutação em backoff não aparece como pendente antes da hora", async () => {
  let relogio = AGORA.getTime();
  const queue = new MutationQueue(new InMemoryMutationStorage(), {
    agora: () => new Date(relogio),
    baseMs: 1000,
    rand: () => 0,
  });
  await queue.enfileirar({ idempotency_key: "k4", entidade: "delivery", operacao: "criar", payload: {} });
  await queue.registrarFalha("k4");
  assert.equal((await queue.pendentes()).length, 0); // ainda em backoff
  relogio += 5_000; // avança 5 s
  assert.equal((await queue.pendentes()).length, 1); // elegível de novo
});

test("após maxTentativas a mutação vai para erro", async () => {
  const queue = new MutationQueue(new InMemoryMutationStorage(), {
    agora: agoraFixo,
    maxTentativas: 3,
    rand: () => 0,
  });
  await queue.enfileirar({ idempotency_key: "k5", entidade: "delivery", operacao: "criar", payload: {} });
  await queue.registrarFalha("k5");
  await queue.registrarFalha("k5");
  const m = await queue.registrarFalha("k5");
  assert.equal(m?._syncStatus, "erro");
  assert.equal(m?.proximaTentativa, null);
});
