export interface RouteProgressBarProps {
  concluidas: number;
  total: number;
}

/** Barra de progresso da rota do dia. */
export function RouteProgressBar({ concluidas, total }: RouteProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((concluidas / total) * 100);
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-valuenow={concluidas}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Progresso da rota: ${concluidas} de ${total} entregas`}
        className="h-3 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-green-700 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-base text-gray-700">
        {concluidas} de {total} entregas concluídas ({pct}%)
      </p>
    </div>
  );
}
