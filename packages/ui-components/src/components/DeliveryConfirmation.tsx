import { useRef, useState } from "react";

export interface DeliveryConfirmationProps {
  entregaId: string;
  onConfirmar: (comprovante: {
    tipo: "foto" | "assinatura" | "qrcode";
    valor: string;
  }) => void;
}

/**
 * Confirmação de entrega com foto, assinatura ou QR.
 * Funciona offline: o chamador enfileira a mutação (ADR-0003).
 */
export function DeliveryConfirmation({ entregaId, onConfirmar }: {
  entregaId: string;
  onConfirmar: DeliveryConfirmationProps["onConfirmar"];
}) {
  const [tipo, setTipo] = useState<"foto" | "assinatura" | "qrcode">("foto");
  const [assinatura, setAssinatura] = useState("");
  const [qrcode, setQrcode] = useState("");
  const fotoRef = useRef<HTMLInputElement>(null);

  function confirmar() {
    if (tipo === "foto") {
      const arquivo = fotoRef.current?.files?.[0];
      if (!arquivo) return;
      onConfirmar({ tipo, valor: arquivo.name });
    } else if (tipo === "assinatura") {
      if (!assinatura.trim()) return;
      onConfirmar({ tipo, valor: assinatura.trim() });
    } else {
      if (!qrcode.trim()) return;
      onConfirmar({ tipo, valor: qrcode.trim() });
    }
  }

  return (
    <fieldset className="rounded-xl border border-gray-200 bg-white p-4">
      <legend className="px-1 text-base font-semibold text-gray-900">
        Confirmar entrega {entregaId}
      </legend>
      <div role="radiogroup" aria-label="Tipo de comprovante" className="mb-4 flex gap-2">
        {(["foto", "assinatura", "qrcode"] as const).map((t) => (
          <label
            key={t}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-base"
          >
            <input
              type="radio"
              name="tipo-comprovante"
              value={t}
              checked={tipo === t}
              onChange={() => setTipo(t)}
              className="h-5 w-5 accent-blue-700"
            />
            {t === "foto" ? "Foto" : t === "assinatura" ? "Assinatura" : "QR Code"}
          </label>
        ))}
      </div>

      {tipo === "foto" && (
        <label className="block text-base text-gray-800">
          Foto do comprovante
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-1 block w-full text-base"
          />
        </label>
      )}
      {tipo === "assinatura" && (
        <label className="block text-base text-gray-800">
          Nome de quem recebeu
          <input
            type="text"
            value={assinatura}
            onChange={(e) => setAssinatura(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
            placeholder="Nome completo"
          />
        </label>
      )}
      {tipo === "qrcode" && (
        <label className="block text-base text-gray-800">
          Código lido
          <input
            type="text"
            value={qrcode}
            onChange={(e) => setQrcode(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
            placeholder="Conteúdo do QR Code"
          />
        </label>
      )}

      <button
        type="button"
        onClick={confirmar}
        className="mt-4 min-h-11 w-full rounded-lg bg-green-700 px-4 text-base font-semibold text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
      >
        Confirmar entrega
      </button>
      <p className="mt-2 text-sm text-gray-600">
        Funciona sem conexão: a confirmação é sincronizada automaticamente.
      </p>
    </fieldset>
  );
}
