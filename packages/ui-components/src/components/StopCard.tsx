import type { StatusEntrega } from "../tokens";
import { rotulosStatus } from "../tokens";

export interface StopCardProps {
  sequencia: number;
  titulo: string;
  endereco: string;
  janela?: string;
  status: StatusEntrega;
  proxima?: boolean;
  onAbrir?: () => void;
}

const estiloStatus: Record<StatusEntrega, string> = {
  criada: "bg-gray-100 text-gray-800",
  atribuida: "bg-blue-100 text-blue-900",
  em_rota: "bg-blue-700 text-white",
  entregue: "bg-green-100 text-green-900",
  falha: "bg-orange-100 text-orange-900",
  cancelada: "bg-gray-200 text-gray-600 line-through",
};

/** Cartão de parada — legível em trânsito, operável com uma mão. */
export function StopCard(props: StopCardProps) {
  const { sequencia, titulo, endereco, janela, status, proxima, onAbrir } = props;
  return (
    <li
      className={[
        "rounded-xl border p-4 shadow-sm",
        proxima ? "border-blue-700 ring-2 ring-blue-700" : "border-gray-200",
        "bg-white",
      ].join(" ")}
      aria-current={proxima ? "true" : undefined}
    >
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-11 w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        aria-label={`Parada ${sequencia}: ${titulo}, ${rotulosStatus[status]}`}
      >
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white"
        >
          {sequencia}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-gray-900">
            {titulo}
          </span>
          <span className="block truncate text-base text-gray-600">{endereco}</span>
          {janela && (
            <span className="block text-base text-gray-600">Janela: {janela}</span>
          )}
        </span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${estiloStatus[status]}`}
        >
          {rotulosStatus[status]}
        </span>
      </button>
    </li>
  );
}
