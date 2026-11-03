/** Configuração do gateway via variáveis de ambiente (Bloco 5, item 1). */

export interface GatewayConfig {
  /** URL do JWKS do provedor OIDC (Keycloak). Prioritária sobre o segredo dev. */
  jwksUrl?: string;
  /** Segredo HS256 APENAS para desenvolvimento local (nunca em produção). */
  devSecret?: string;
  /** Issuer e audience esperados no token. */
  issuer?: string;
  audience?: string;
  /** Endpoints internos dos serviços. */
  geoNormalizerUrl: string;
  routeOptimizerUrl: string;
  /** Rate limiting por tenant + endpoint. */
  rateLimit: { capacidade: number; refillPorSegundo: number };
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    jwksUrl: env.AUTH_JWKS_URL,
    devSecret: env.AUTH_DEV_SECRET ?? "dev-secret-inseguro-trocar",
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE,
    geoNormalizerUrl: env.GEO_NORMALIZER_URL ?? "http://localhost:8001",
    routeOptimizerUrl: env.ROUTE_OPTIMIZER_URL ?? "http://localhost:8002",
    rateLimit: {
      capacidade: Number(env.RATE_LIMIT_CAPACIDADE ?? 60),
      refillPorSegundo: Number(env.RATE_LIMIT_REFILL_S ?? 1),
    },
  };
}
