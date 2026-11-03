export type StatusSync = "pendente" | "sincronizando" | "sincronizado" | "erro" | "offline";

export interface SyncIndicatorProps {
  status: StatusSync;
  pendentes: number;
}

const rotulo: Record<StatusSync, string> = {
  sincronizado: "Tudo sincronizado",
  sincronizando: "Sincronizando…",
  pendente: "Alterações pendentes",
  erro: "Falha na sincronização",
  offline: "Sem conexão — trabalhando offline",
};

const icone: Record<StatusSync, string> = {
  sincronizado: "✓",
  sincronizando: "↻",
  pendente: "●",
  erro: "!",
  offline: "⚠",
};

const cor: Record<StatusSync, string> = {
  sincronizado: "text-green-800",
  sincronizando: "text-blue-800",
  pendente: "text-blue-800",
  erro: "text-red-800",
  offline: "text-orange-800",
};

/** Indicador discreto do estado de sincronização (aria-live para leitores de tela). */
export function SyncIndicator({ status, pendentes }: SyncIndicatorProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex min-h-11 items-center gap-2 text-base font-medium ${cor[status]}`}
    >
      <span aria-hidden="true">{icone[status]}</span>
      {rotulo[status]}
      {pendentes > 0 && status !== "sincronizado" && (
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-sm text-gray-800">
          {pendentes}
        </span>
      )}
    </span>
  );
}
