/**
 * Verificação de tokens OAuth2/OIDC (Bloco 6, item 2).
 *
 * Produção: valida assinatura contra o JWKS do provedor (Keycloak).
 * Desenvolvimento: segredo HS256 local via AUTH_DEV_SECRET.
 * MFA: perfis admin/gestor exigem `amr` com fator forte ou `acr` ≥ aal2.
 */
import { createRemoteJWKSet, importJWK, jwtVerify, type JWTPayload } from "jose";
import type { GatewayConfig } from "./config.js";

export interface TokenVerificado {
  sub: string;
  tenantId: string;
  scopes: string[];
  mfaOk: boolean;
}

export interface Verificador {
  verificar(token: string): Promise<TokenVerificado>;
}

const ACR_MINIMOS_MFA = new Set(["aal2", "aal3", "gold"]);
const AMR_FORTES = new Set(["mfa", "otp", "webauthn", "hwk", "fido2"]);

export function criarVerificador(config: GatewayConfig): Verificador {
  const jwks = config.jwksUrl ? createRemoteJWKSet(new URL(config.jwksUrl)) : null;

  return {
    async verificar(token: string): Promise<TokenVerificado> {
      let payload: JWTPayload;
      if (jwks) {
        const { payload: p } = await jwtVerify(token, jwks, {
          issuer: config.issuer,
          audience: config.audience,
        });
        payload = p;
      } else {
        const chave = await importJWK(
          { kty: "oct", k: btoa(config.devSecret ?? "") },
          "HS256",
        );
        const { payload: p } = await jwtVerify(token, chave, {
          issuer: config.issuer,
          audience: config.audience,
        });
        payload = p;
      }

      const scopes = String(payload.scope ?? "").split(" ").filter(Boolean);
      const amr = Array.isArray(payload.amr) ? payload.amr.map(String) : [];
      const acr = String(payload.acr ?? "").toLowerCase();
      const mfaOk =
        amr.some((m) => AMR_FORTES.has(m.toLowerCase())) ||
        ACR_MINIMOS_MFA.has(acr);

      return {
        sub: String(payload.sub ?? ""),
        tenantId: String(payload.tenant_id ?? ""),
        scopes,
        mfaOk,
      };
    },
  };
}
