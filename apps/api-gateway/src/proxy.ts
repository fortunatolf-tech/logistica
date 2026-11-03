/**
 * Roteamento para os serviços internos (Bloco 5). O gateway nunca expõe
 * os serviços diretamente: toda chamada passa por auth → RBAC → rate limit.
 */

export interface Destino {
  prefixo: string;
  baseUrl: string;
}

export function destinosDe(config: {
  geoNormalizerUrl: string;
  routeOptimizerUrl: string;
}): Destino[] {
  return [
    { prefixo: "/v1/locations", baseUrl: config.geoNormalizerUrl },
    { prefixo: "/v1/routes", baseUrl: config.routeOptimizerUrl },
  ];
}

export type ResultadoProxy =
  | { ok: true; status: number; corpo: unknown }
  | { ok: false; motivo: "destino_desconhecido" | "servico_indisponivel" };

export async function proximar(
  destinos: Destino[],
  metodo: string,
  caminho: string,
  corpo: unknown,
  cabecalhos: Record<string, string>,
): Promise<ResultadoProxy> {
  const destino = destinos.find((d) => caminho.startsWith(d.prefixo));
  if (!destino) return { ok: false, motivo: "destino_desconhecido" };
  try {
    const resp = await fetch(`${destino.baseUrl}${caminho}`, {
      method: metodo,
      headers: { "content-type": "application/json", ...cabecalhos },
      body: metodo === "GET" || metodo === "HEAD" ? undefined : JSON.stringify(corpo),
    });
    return { ok: true, status: resp.status, corpo: await resp.json().catch(() => null) };
  } catch {
    return { ok: false, motivo: "servico_indisponivel" };
  }
}
