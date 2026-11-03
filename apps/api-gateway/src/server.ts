/**
 * Servidor Fastify do API Gateway.
 *
 * Pipeline por requisição: autenticação (Bearer/OIDC) → RBAC → rate limit
 * por tenant+endpoint → proxy ao serviço interno. `proximar` é injetável
 * para testes sem rede.
 */
import Fastify, { type FastifyInstance } from "fastify";
import { criarVerificador, type Verificador } from "./auth.js";
import { configFromEnv, type GatewayConfig } from "./config.js";
import { destinosDe, proximar, type ResultadoProxy } from "./proxy.js";
import { RateLimiter } from "./rate-limit.js";
import { autorizar } from "./rbac.js";

export interface AppDeps {
  config?: Partial<GatewayConfig>;
  verificador?: Verificador;
  proximar?: typeof proximar;
}

export async function buildApp(deps: AppDeps = {}): Promise<FastifyInstance> {
  const config: GatewayConfig = { ...configFromEnv(), ...deps.config };
  const verificador = deps.verificador ?? criarVerificador(config);
  const prox = deps.proximar ?? proximar;
  const destinos = destinosDe(config);
  const limiter = new RateLimiter({
    capacidade: config.rateLimit.capacidade,
    refillPorSegundo: config.rateLimit.refillPorSegundo,
  });

  const app = Fastify({ logger: false });

  app.get("/healthz", async () => ({ status: "ok", servico: "api-gateway" }));

  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    url: "/v1/*",
    handler: async (request, reply) => {
      const caminho = request.url.split("?")[0] ?? request.url;
      const metodo = request.method;

      // 1) Autenticação
      const header = request.headers.authorization ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token) {
        return reply.status(401).send({ motivo: "token_ausente" });
      }
      let verificado;
      try {
        verificado = await verificador.verificar(token);
      } catch {
        return reply.status(401).send({ motivo: "token_invalido" });
      }

      // 2) RBAC (+ MFA para perfis privilegiados)
      const decisao = autorizar(metodo, caminho, verificado.scopes, verificado.mfaOk);
      if (!decisao.autorizado) {
        return reply.status(403).send({ motivo: decisao.motivo });
      }

      // 3) Rate limiting por tenant + endpoint
      const chave = `${verificado.tenantId}:${metodo}:${caminho}`;
      if (!limiter.permitir(chave)) {
        return reply.status(429).send({ motivo: "limite_excedido" });
      }

      // 4) Proxy ao serviço interno, propagando o contexto do tenant
      const resultado: ResultadoProxy = await prox(
        destinos,
        metodo,
        caminho,
        request.body,
        {
          "x-tenant-id": verificado.tenantId,
          "x-operador": verificado.sub,
        },
      );
      if (!resultado.ok) {
        const status = resultado.motivo === "destino_desconhecido" ? 404 : 502;
        return reply.status(status).send({ motivo: resultado.motivo });
      }
      return reply.status(resultado.status).send(resultado.corpo);
    },
  });

  return app;
}

// Execução direta: `node dist/src/server.js`
const ehPrincipal = process.argv[1]?.endsWith("server.js");
if (ehPrincipal) {
  const porta = Number(process.env.PORT ?? 8000);
  buildApp().then((app) =>
    app.listen({ port: porta, host: "0.0.0.0" }).then(() => {
      console.log(`api-gateway ouvindo em :${porta}`);
    }),
  );
}
