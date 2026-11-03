export interface OfflineBannerProps {
  visivel: boolean;
  pendentes?: number;
}

/** Faixa persistente de modo offline (role=alert para anúncio imediato). */
export function OfflineBanner({ visivel, pendentes = 0 }: OfflineBannerProps) {
  if (!visivel) return null;
  return (
    <div
      role="alert"
      className="flex min-h-11 items-center justify-center gap-2 bg-orange-600 px-4 py-2 text-base font-medium text-white"
    >
      <span aria-hidden="true">⚠</span>
      Sem conexão. Suas ações continuam valendo
      {pendentes > 0 ? ` (${pendentes} pendente${pendentes > 1 ? "s" : ""})` : ""}.
    </div>
  );
}
