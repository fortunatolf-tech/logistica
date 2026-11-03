import { type ReactNode } from "react";
import { ENTREGAS_EXEMPLO } from "./entregas-exemplo";

/** Dashboard do gestor — responsivo para tablet (Bloco 4, item 2). */
export default function DashboardScreen(): ReactNode {
  const total = ENTREGAS_EXEMPLO.length;
  const concluidas = ENTREGAS_EXEMPLO.filter((e) => e.status === "entregue").length;
  const emRota = ENTREGAS_EXEMPLO.filter((e) => e.status === "em_rota").length;

  const kpis = [
    { rotulo: "Entregas do dia", valor: String(total) },
    { rotulo: "Concluídas", valor: String(concluidas) },
    { rotulo: "Em rota agora", valor: String(emRota) },
    {
      rotulo: "Aderência a janelas",
      valor: total ? `${Math.round((concluidas / total) * 100)}%` : "—",
    },
  ];

  return (
    <section aria-labelledby="titulo-dashboard">
      <h2 id="titulo-dashboard" className="text-lg font-semibold">
        Painel do gestor
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.rotulo}
            className="rounded-xl border border-gray-200 bg-white p-4 text-center"
          >
            <p className="text-3xl font-bold text-blue-700">{k.valor}</p>
            <p className="mt-1 text-base text-gray-700">{k.rotulo}</p>
          </div>
        ))}
      </div>
      <div
        role="img"
        aria-label="Mapa da frota (placeholder até a integração com o MapProvider)"
        className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-100 text-gray-600"
      >
        Mapa da frota — integração com MapProvider (ADR-0002)
      </div>
    </section>
  );
}
