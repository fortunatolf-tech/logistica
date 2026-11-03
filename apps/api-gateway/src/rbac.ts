/**
 * RBAC com menor privilégio (Bloco 6, item 3): cada rota declara os scopes
 * aceitos e se exige MFA. Scopes ausentes ou MFA faltando → 403.
 */

export type Perfil = "admin" | "gestor" | "entregador" | "integracao";

export interface RegraRota {
  metodo: string;
  /** Prefixo de caminho (ex.: "/v1/locations"). */
  caminho: string;
  scopes: Perfil[];
  mfaObrigatoria: boolean;
}

export const REGRAS: RegraRota[] = [
  { metodo: "POST", caminho: "/v1/locations/normalize", scopes: ["entregador", "gestor", "integracao"], mfaObrigatoria: false },
  { metodo: "POST", caminho: "/v1/routes/optimize", scopes: ["gestor", "integracao"], mfaObrigatoria: false },
  { metodo: "POST", caminho: "/v1/deliveries", scopes: ["gestor", "integracao"], mfaObrigatoria: false },
  { metodo: "GET", caminho: "/v1/deliveries", scopes: ["entregador", "gestor", "integracao"], mfaObrigatoria: false },
  { metodo: "POST", caminho: "/v1/webhooks", scopes: ["gestor"], mfaObrigatoria: true },
  { metodo: "POST", caminho: "/v1/lgpd/requests", scopes: ["admin"], mfaObrigatoria: true },
];

export type DecisaoRbac =
  | { autorizado: true }
  | { autorizado: false; motivo: "rota_desconhecida" | "scope_insuficiente" | "mfa_ausente" };

export function autorizar(
  metodo: string,
  caminho: string,
  scopes: string[],
  mfaOk: boolean,
): DecisaoRbac {
  const regra = REGRAS.find(
    (r) => r.metodo === metodo && caminho.startsWith(r.caminho),
  );
  if (!regra) return { autorizado: false, motivo: "rota_desconhecida" };
  if (!regra.scopes.some((s) => scopes.includes(s))) {
    return { autorizado: false, motivo: "scope_insuficiente" };
  }
  if (regra.mfaObrigatoria && !mfaOk) {
    return { autorizado: false, motivo: "mfa_ausente" };
  }
  return { autorizado: true };
}
