import { test } from "node:test";
import assert from "node:assert/strict";
import { importJWK, SignJWT } from "jose";
import { criarVerificador } from "../src/auth.js";
import type { GatewayConfig } from "../src/config.js";

const SEGREDO = "segredo-de-teste";

function config(): GatewayConfig {
  return {
    devSecret: SEGREDO,
    geoNormalizerUrl: "http://interno:8001",
    routeOptimizerUrl: "http://interno:8002",
    rateLimit: { capacidade: 60, refillPorSegundo: 1 },
  };
}

async function token(claims: Record<string, unknown>, segredo = SEGREDO): Promise<string> {
  const chave = await importJWK({ kty: "oct", k: btoa(segredo) }, "HS256");
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(chave);
}

test("token válido retorna sub, tenant e scopes", async () => {
  const v = criarVerificador(config());
  const jwt = await token({ sub: "u1", tenant_id: "t1", scope: "gestor", amr: ["otp"] });
  const r = await v.verificar(jwt);
  assert.equal(r.sub, "u1");
  assert.equal(r.tenantId, "t1");
  assert.deepEqual(r.scopes, ["gestor"]);
  assert.equal(r.mfaOk, true);
});

test("token expirado é rejeitado", async () => {
  const v = criarVerificador(config());
  const chave = await importJWK({ kty: "oct", k: btoa(SEGREDO) }, "HS256");
  const expirado = await new SignJWT({ sub: "u1", tenant_id: "t1", scope: "gestor" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
    .sign(chave);
  await assert.rejects(() => v.verificar(expirado));
});

test("assinatura com segredo errado é rejeitada", async () => {
  const v = criarVerificador(config());
  const jwt = await token({ sub: "u1", scope: "gestor" }, "outro-segredo");
  await assert.rejects(() => v.verificar(jwt));
});

test("acr aal2 também conta como MFA", async () => {
  const v = criarVerificador(config());
  const jwt = await token({ sub: "u1", tenant_id: "t1", scope: "admin", acr: "aal2" });
  const r = await v.verificar(jwt);
  assert.equal(r.mfaOk, true);
});

test("sem fator forte, mfaOk é falso", async () => {
  const v = criarVerificador(config());
  const jwt = await token({ sub: "u1", tenant_id: "t1", scope: "admin", amr: ["pwd"] });
  const r = await v.verificar(jwt);
  assert.equal(r.mfaOk, false);
});
