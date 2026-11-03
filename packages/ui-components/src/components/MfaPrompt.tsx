import { useState } from "react";

export interface MfaPromptProps {
  onVerificar: (codigo: string) => void;
  onWebAuthn?: () => void;
  erro?: string;
}

/** Segundo fator: código de 6 dígitos, com biometria opcional (WebAuthn). */
export function MfaPrompt({ onVerificar, onWebAuthn, erro }: MfaPromptProps) {
  const [codigo, setCodigo] = useState("");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">Verificação em duas etapas</h2>
      <label className="mt-3 block text-base text-gray-800" htmlFor="mfa-codigo">
        Código de 6 dígitos do seu aplicativo autenticador
      </label>
      <input
        id="mfa-codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? "mfa-erro" : undefined}
        className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-center text-2xl tracking-[0.5em]"
      />
      {erro && (
        <p id="mfa-erro" role="alert" className="mt-2 text-base font-medium text-red-700">
          {erro}
        </p>
      )}
      <button
        type="button"
        onClick={() => onVerificar(codigo)}
        disabled={codigo.length !== 6}
        className="mt-4 min-h-11 w-full rounded-lg bg-blue-700 px-4 text-base font-semibold text-white hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Verificar
      </button>
      {onWebAuthn && (
        <button
          type="button"
          onClick={onWebAuthn}
          className="mt-2 min-h-11 w-full rounded-lg border border-blue-700 px-4 text-base font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Usar biometria (WebAuthn)
        </button>
      )}
    </div>
  );
}
