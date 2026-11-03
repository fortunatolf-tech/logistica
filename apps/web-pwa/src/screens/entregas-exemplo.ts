import type { StatusEntrega } from "@rotaviva/ui-components";

export interface EntregaDia {
  id: string;
  titulo: string;
  endereco: string;
  janela: string;
  status: StatusEntrega;
}

/** Dados de exemplo até o delivery-service existir (incremento 3). */
export const ENTREGAS_EXEMPLO: EntregaDia[] = [
  { id: "e101", titulo: "Pedido #4821", endereco: "Rua Augusta, 1200 — Consolação", janela: "09:00–10:30", status: "em_rota" },
  { id: "e102", titulo: "Pedido #4822", endereco: "Av. Paulista, 950 — Bela Vista", janela: "09:30–11:00", status: "atribuida" },
  { id: "e103", titulo: "Pedido #4827", endereco: "Rua Oscar Freire, 300 — Jardins", janela: "10:00–12:00", status: "atribuida" },
  { id: "e104", titulo: "Pedido #4831", endereco: "Rua da Consolação, 77 — Centro", janela: "11:00–13:00", status: "criada" },
];
