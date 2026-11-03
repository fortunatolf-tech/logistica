import { useState, type ReactNode } from "react";
import { RouteProgressBar, StopCard } from "@rotaviva/ui-components";
import { ENTREGAS_EXEMPLO, type EntregaDia } from "./entregas-exemplo";

export default function DeliveriesScreen({
  navegar,
}: {
  navegar: (rota: string) => void;
}): ReactNode {
  const [entregas] = useState<EntregaDia[]>(ENTREGAS_EXEMPLO);
  const concluidas = entregas.filter((e) => e.status === "entregue").length;
  const proximaIdx = entregas.findIndex((e) => e.status !== "entregue");

  return (
    <section aria-labelledby="titulo-entregas">
      <h2 id="titulo-entregas" className="text-lg font-semibold">
        Entregas do dia
      </h2>
      <div className="my-3">
        <RouteProgressBar concluidas={concluidas} total={entregas.length} />
      </div>
      <ul className="flex flex-col gap-3">
        {entregas.map((e, i) => (
          <StopCard
            key={e.id}
            sequencia={i + 1}
            titulo={e.titulo}
            endereco={e.endereco}
            janela={e.janela}
            status={e.status}
            proxima={i === proximaIdx}
            onAbrir={() => navegar("/rota")}
          />
        ))}
      </ul>
    </section>
  );
}
