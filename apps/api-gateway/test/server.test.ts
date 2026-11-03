import { test } from "node:test";
import assert from "node:assert/strict";
import { importJWK, SignJWT } from "jose";
import { buildApp } from "../src/server.js";
import type { ResultadoProxy } from "../src/proxy.js";

const SEGREDO = "segredo-de-teste";

async function token(claims: Record<string, unknown>): Promise<string> {
  const chave = await importJWK({ kty: "oct", k: btoa(SEGREDO) }, "HS256");
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(chave);
}

function proxyFake(cabecalhosVistos: Record<string, string>[]) {
  return async (
    _d: unknown,
    _m: string,
    _c: string,
    _corpo: unknown,
    cabecalhos: Record<string, string>,
  ): Promise<ResultadoProxy> => {
    cabecalhosVistos.push(cabecalhos);
    return { ok: true, status: 200, corpo: { ok: true } };
  };
}

async function app(opcoes: { capacidade?: number } = {}) {
  return buildApp({
    config: {
      devSecret: SEGREDO,
      rateLimit: { capacidade: opcoes.capacidade ?? 100, refillPorSegundo: 0 },
    },
  });
}

test("sem token → 401", async () => {
  const a = await app();
  const resp = await a.inject({ method: "POST", url: "/v1/routes/optimize", payload: {} });
  assert.equal(resp.statusCode, 401);
  await a.close();
});

test("scope insuficiente → 403", async () => {
  const a = await app();
  const jwt = await token({ sub: "u1", tenant_id: "t1", scope: "entregador" });
  const resp = await a.inject({
    method: "POST",
    url: "/v1/routes/optimize",
    headers: { authorization: `Bearer ${jwt}` },
    payload: {},
  });
  assert.equal(resp.statusCode, 403);
  assert.equal(resp.json().motivo, "scope_insuficiente");
  await a.close();
});

test("LGPD sem MFA → 403 mfa_ausente", async () => {
  const a = await app();
  const jwt = await token({ sub: "u1", tenant_id: "t1", scope: "admin", amr: ["pwd"] });
  const resp = await a.inject({
    method: "POST",
    url: "/v1/lgpd/requests",
    headers: { authorization: `Bearer ${jwt}` },
    payload: {},
  });
  assert.equal(resp.statusCode, 403);
  assert.equal(resp.json().motivo, "mfa_ausente");
  await a.close();
});

test("requisição autorizada é proximada com contexto de tenant", async () => {
  const vistos: Record<string, string>[] = [];
  const a = await buildApp({
    config: {
      devSecret: SEGREDO,
      rateLimit: { capacidade: 100, refillPorSegundo: 0 },
    },
    proximar: proxyFake(vistos) as never,
  });
  const jwt = await token({ sub: "u9", tenant_id: "t-42", scope: "gestor" });
  const resp = await a.inject({
    method: "POST",
    url: "/v1/routes/optimize",
    headers: { authorization: `Bearer ${jwt}` },
    payload: { tenant_id: "t-42", entregas: [] },
  });
  assert.equal(resp.statusCode, 200);
  assert.equal(vistos[0]?.["x-tenant-id"], "t-42");
  assert.equal(vistos[0]?.["x-operador"], "u9");
  await a.close();
});

test("rate limit por tenant → 429 após estourar a capacidade", async () => {
  const a = await app({ capacidade: 2 });
  const jwt = await token({ sub: "u1", tenant_id: "t1", scope: "entregador" });
  const cab = { authorization: `Bearer ${jwt}` };
  const url = "/v1/locations/normalize";
  const r1 = await a.inject({ method: "POST", url, headers: cab, payload: {} });
  const r2 = await a.inject({ method: "POST", url, headers: cab, payload: {} });
  const r3 = await a.inject({ method: "POST", url, headers: cab, payload: {} });
  assert.notEqual(r1.statusCode, 429);
  assert.notEqual(r2.statusCode, 429);
  assert.equal(r3.statusCode, 429);
  await a.close();
});

test("healthz é público", async () => {
  const a = await app();
  const resp = await a.inject({ method: "GET", url: "/healthz" });
  assert.equal(resp.statusCode, 200);
  await a.close();
});
