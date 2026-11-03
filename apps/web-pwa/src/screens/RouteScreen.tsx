import { type ReactNode } from "react";
import { RouteProgressBar } from "@rotaviva/ui-components";
import { ENTREGAS_EXEMPLO } from "./entregas-exemplo";

export default function RouteScreen({
  navegar,
}: {
  navegar: (rota: string) => void;
}): ReactNode {
  const proxima = ENTREGAS_EXEMPLO.find((e) => e.status !== "entregue");
  const concluidas = ENTREGAS_EXEMPLO.filter((e) => e.status === "entregue").length;

  return (
    <section aria-labelledby="titulo-rota">
      <h2 id="titulo-rota" className="text-lg font-semibold">
        Navegação em rota
      </h2>
      <div className="my-3">
        <RouteProgressBar concluidas={concluidas} total={ENTREGAS_EXEMPLO.length} />
      </div>

      {proxima ? (
        <article
          aria-labelledby="proxima-parada"
          className="rounded-xl border-2 border-blue-700 bg-white p-4"
        >
          <h3 id="proxima-parada" className="text-base font-semibold text-blue-900">
            Próxima parada
          </h3>
          <p className="mt-1 text-xl font-bold text-gray-900">{proxima.titulo}</p>
          <p className="text-base text-gray-700">{proxima.endereco}</p>
          <p className="text-base text-gray-700">Janela: {proxima.janela}</p>
          <ol className="mt-3 list-decimal pl-5 text-base text-gray-800">
            <li>Siga pela via principal até o cruzamento indicado.</li>
            <li>Vire à direita e siga por 300 m.</li>
            <li>O destino estará à esquerda.</li>
          </ol>
          <button
            type="button"
            onClick={() => navegar("/confirmar")}
            className="mt-4 min-h-11 w-full rounded-lg bg-green-700 px-4 text-lg font-semibold text-white hover:bg-green-800"
          >
            Cheguei
          </button>
        </article>
      ) : (
        <p role="status" className="text-base">
          Todas as entregas do dia foram concluídas. 🎉
        </p>
      )}
    </section>
  );
}
