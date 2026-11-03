import { useState, type ReactNode } from "react";
import { DeliveryConfirmation } from "@rotaviva/ui-components";
import { useOffline } from "../App";
import { ENTREGAS_EXEMPLO } from "./entregas-exemplo";

export default function ConfirmScreen({
  navegar,
}: {
  navegar: (rota: string) => void;
}): ReactNode {
  const { fila } = useOffline();
  const [confirmada, setConfirmada] = useState(false);
  const proxima = ENTREGAS_EXEMPLO.find((e) => e.status !== "entregue");

  async function confirmar(comprovante: { tipo: string; valor: string }) {
    // Offline-first: a confirmação entra na fila local imediatamente;
    // o SyncEngine entrega ao servidor quando houver conexão (ADR-0003).
    await fila.enfileirar({
      idempotency_key: crypto.randomUUID(),
      entidade: "delivery",
      operacao: "atualizar",
      payload: {
        id: proxima?.id,
        status: "entregue",
        comprovante,
      },
    });
    setConfirmada(true);
  }

  if (!proxima) {
    return (
      <p role="status" className="text-base">
        Não há entrega pendente para confirmar.
      </p>
    );
  }

  return confirmada ? (
    <div role="status" className="rounded-xl bg-green-50 p-4">
      <h2 className="text-lg font-semibold text-green-900">Entrega confirmada ✓</h2>
      <p className="mt-1 text-base text-green-900">
        A confirmação já está salva no aparelho e será sincronizada automaticamente.
      </p>
      <button
        type="button"
        onClick={() => navegar("/rota")}
        className="mt-4 min-h-11 w-full rounded-lg bg-blue-700 px-4 text-base font-semibold text-white"
      >
        Próxima parada
      </button>
    </div>
  ) : (
    <DeliveryConfirmation entregaId={proxima.id} onConfirmar={confirmar} />
  );
}
