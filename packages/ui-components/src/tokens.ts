/**
 * Tokens do design system RotaViva (Bloco 4, item 1).
 *
 * Paleta: azul primário, verde de confirmação, laranja de alerta,
 * vermelho apenas para erro crítico. Corpo mínimo de 16 px.
 * Alvos de toque ≥ 44 px (WCAG 2.2 AA — 2.5.8).
 */

export const cores = {
  primario: "#1D4ED8",      // azul — ações principais
  primarioTexto: "#FFFFFF",
  sucesso: "#15803D",       // verde — confirmação (contraste AA sobre branco)
  alerta: "#C2410C",        // laranja — alertas não críticos
  erroCritico: "#B91C1C",   // vermelho — SOMENTE erro crítico
  neutro900: "#111827",
  neutro600: "#4B5563",
  neutro100: "#F3F4F6",
  fundo: "#FFFFFF",
} as const;

export const tipografia = {
  corpoMinPx: 16,
  familia:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
} as const;

export const toque = {
  alvoMinPx: 44,
} as const;

export type StatusEntrega =
  | "criada"
  | "atribuida"
  | "em_rota"
  | "entregue"
  | "falha"
  | "cancelada";

export const rotulosStatus: Record<StatusEntrega, string> = {
  criada: "Criada",
  atribuida: "Atribuída",
  em_rota: "Em rota",
  entregue: "Entregue",
  falha: "Falha",
  cancelada: "Cancelada",
};
