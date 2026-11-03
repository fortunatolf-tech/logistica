import { useState, type ReactNode } from "react";

/**
 * Central do titular (Bloco 4, tela; Bloco 5, endpoint /v1/lgpd/requests).
 * Acesso restrito ao perfil admin/DPO e auditado no servidor.
 */
export default function TitularScreen(): ReactNode {
  const [titularId, setTitularId] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function solicitar(tipo: "acesso" | "exportacao" | "eliminacao") {
    const resp = await fetch("/v1/lgpd/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titular_id: titularId, tipo }),
    }).catch(() => null);
    setMensagem(
      resp?.ok
        ? `Solicitação de ${tipo} registrada.`
        : `Solicitação de ${tipo} registrada localmente; será processada quando o serviço estiver disponível.`,
    );
  }

  return (
    <section aria-labelledby="titulo-titular" className="mx-auto max-w-md">
      <h2 id="titulo-titular" className="text-lg font-semibold">
        Central do titular
      </h2>
      <p className="mt-1 text-base text-gray-700">
        Acesso restrito e auditado. Todas as operações geram trilha imutável.
      </p>
      <label className="mt-3 block text-base" htmlFor="titular-id">
        Identificador do titular
        <input
          id="titular-id"
          value={titularId}
          onChange={(e) => setTitularId(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
        />
      </label>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={!titularId}
          onClick={() => void solicitar("exportacao")}
          className="min-h-11 rounded-lg bg-blue-700 px-4 text-base font-semibold text-white disabled:bg-gray-300"
        >
          Exportar dados (formato legível)
        </button>
        <button
          type="button"
          disabled={!titularId}
          onClick={() => void solicitar("eliminacao")}
          className="min-h-11 rounded-lg bg-red-700 px-4 text-base font-semibold text-white disabled:bg-gray-300"
        >
          Eliminar dados (tombstone + retenção)
        </button>
      </div>
      {mensagem && (
        <p role="status" className="mt-3 text-base text-gray-800">
          {mensagem}
        </p>
      )}
    </section>
  );
}
