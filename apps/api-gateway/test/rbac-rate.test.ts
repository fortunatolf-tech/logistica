import { test } from "node:test";
import assert from "node:assert/strict";
import { autorizar } from "../src/rbac.js";
import { RateLimiter } from "../src/rate-limit.js";

// ---- RBAC -----------------------------------------------------------------

test("entregador pode normalizar localização, mas não otimizar rotas", () => {
  assert.deepEqual(
    autorizar("POST", "/v1/locations/normalize", ["entregador"], false),
    { autorizado: true },
  );
  assert.deepEqual(
    autorizar("POST", "/v1/routes/optimize", ["entregador"], false),
    { autorizado: false, motivo: "scope_insuficiente" },
  );
});

test("gestor pode otimizar rotas", () => {
  assert.deepEqual(
    autorizar("POST", "/v1/routes/optimize", ["gestor"], false),
    { autorizado: true },
  );
});

test("LGPD exige admin com MFA", () => {
  assert.deepEqual(
    autorizar("POST", "/v1/lgpd/requests", ["gestor"], true),
    { autorizado: false, motivo: "scope_insuficiente" },
  );
  assert.deepEqual(
    autorizar("POST", "/v1/lgpd/requests", ["admin"], false),
    { autorizado: false, motivo: "mfa_ausente" },
  );
  assert.deepEqual(
    autorizar("POST", "/v1/lgpd/requests", ["admin"], true),
    { autorizado: true },
  );
});

test("webhooks exigem MFA de gestor", () => {
  assert.deepEqual(
    autorizar("POST", "/v1/webhooks", ["gestor"], false),
    { autorizado: false, motivo: "mfa_ausente" },
  );
});

test("rota fora do catálogo é negada", () => {
  assert.deepEqual(
    autorizar("GET", "/v1/admin/segredos", ["admin"], true),
    { autorizado: false, motivo: "rota_desconhecida" },
  );
});

test("prefixo casa subcaminhos (tracking)", () => {
  assert.deepEqual(
    autorizar("GET", "/v1/deliveries/abc/tracking", ["entregador"], false),
    { autorizado: true },
  );
});

// ---- Rate limiting ---------------------------------------------------------

test("consome a capacidade e depois bloqueia", () => {
  const limiter = new RateLimiter({ capacidade: 3, refillPorSegundo: 0 });
  assert.equal(limiter.permitir("t1:/v1/x"), true);
  assert.equal(limiter.permitir("t1:/v1/x"), true);
  assert.equal(limiter.permitir("t1:/v1/x"), true);
  assert.equal(limiter.permitir("t1:/v1/x"), false);
});

test("recarrega com o tempo", () => {
  let relogio = 0;
  const limiter = new RateLimiter({
    capacidade: 1,
    refillPorSegundo: 1,
    agora: () => relogio,
  });
  assert.equal(limiter.permitir("k"), true);
  assert.equal(limiter.permitir("k"), false);
  relogio += 1100; // 1,1 s → 1 ficha recarregada
  assert.equal(limiter.permitir("k"), true);
});

test("baldes são independentes por chave (tenant+endpoint)", () => {
  const limiter = new RateLimiter({ capacidade: 1, refillPorSegundo: 0 });
  assert.equal(limiter.permitir("tenantA:/v1/x"), true);
  assert.equal(limiter.permitir("tenantB:/v1/x"), true); // outro tenant
  assert.equal(limiter.permitir("tenantA:/v1/y"), true); // outro endpoint
  assert.equal(limiter.permitir("tenantA:/v1/x"), false);
});
