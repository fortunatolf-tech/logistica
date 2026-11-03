import { test } from "node:test";
import assert from "node:assert/strict";
import { lastWriteWins, mergePorCampo } from "../src/conflict.js";

const T0 = "2026-11-03T10:00:00Z";
const T1 = "2026-11-03T11:00:00Z";
const T2 = "2026-11-03T12:00:00Z";

test("last-write-wins: remoto mais novo vence", () => {
  const local = { status: "em_rota", _lastModified: T0, _localVersion: 3 };
  const remoto = { status: "entregue", _lastModified: T1, _localVersion: 1 };
  assert.equal(lastWriteWins(local, remoto).status, "entregue");
});

test("last-write-wins: local mais novo vence", () => {
  const local = { status: "entregue", _lastModified: T2, _localVersion: 3 };
  const remoto = { status: "em_rota", _lastModified: T1, _localVersion: 9 };
  assert.equal(lastWriteWins(local, remoto).status, "entregue");
});

test("merge por campo combina alterações independentes", () => {
  // Entregador atualizou a foto às T1; o servidor tinha endereço corrigido às T2.
  const local = {
    foto_url: "local/foto.jpg",
    endereco: "Rua A, 100",
    _lastModified: T1,
    _localVersion: 2,
    _campoTs: { foto_url: T1, endereco: T0 },
  };
  const remoto = {
    foto_url: "servidor/antiga.jpg",
    endereco: "Rua A, 100B",
    _lastModified: T2,
    _localVersion: 5,
    _campoTs: { foto_url: T0, endereco: T2 },
  };
  const merged = mergePorCampo(local, remoto);
  assert.equal(merged.foto_url, "local/foto.jpg"); // campo mais novo no local
  assert.equal(merged.endereco, "Rua A, 100B");    // campo mais novo no remoto
  assert.equal(merged._lastModified, T2);
  assert.equal(merged._localVersion, 6);           // max(2,5)+1
  assert.equal(merged._campoTs?.["foto_url"], T1);
  assert.equal(merged._campoTs?.["endereco"], T2);
});

test("merge por campo sem _campoTs usa _lastModified do registro", () => {
  const local = { lat: -23.55, _lastModified: T0, _localVersion: 1 };
  const remoto = { lat: -23.56, _lastModified: T1, _localVersion: 1 };
  // Remoto mais recente vence em todos os campos.
  assert.equal(mergePorCampo(local, remoto).lat, -23.56);
  // Invertendo: local mais recente vence.
  assert.equal(mergePorCampo(remoto, local).lat, -23.56);
});
