import { useState, type FormEvent, type ReactNode } from "react";
import { MfaPrompt } from "@rotaviva/ui-components";

export default function LoginScreen({ onEntrar }: { onEntrar: () => void }): ReactNode {
  const [etapa, setEtapa] = useState<"senha" | "mfa">("senha");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erroMfa, setErroMfa] = useState<string>();

  function enviarSenha(e: FormEvent) {
    e.preventDefault();
    // Neste incremento a autenticação real (OAuth2/OIDC no gateway) ainda não
    // existe: a transição para MFA valida apenas o fluxo de UI.
    setEtapa("mfa");
  }

  function verificarMfa(codigo: string) {
    if (codigo.length !== 6) {
      setErroMfa("Código inválido. Tente novamente.");
      return;
    }
    onEntrar();
  }

  async function tentarWebAuthn() {
    if (!window.PublicKeyCredential) return;
    // Placeholder funcional: o registro/assert real vem com o gateway.
    onEntrar();
  }

  return (
    <div className="mx-auto max-w-sm">
      {etapa === "senha" ? (
        <form
          onSubmit={enviarSenha}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <h2 className="text-lg font-semibold">Entrar</h2>
          <label className="mt-3 block text-base" htmlFor="usuario">
            Usuário
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
            />
          </label>
          <label className="mt-3 block text-base" htmlFor="senha">
            Senha
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
            />
          </label>
          <button
            type="submit"
            className="mt-4 min-h-11 w-full rounded-lg bg-blue-700 px-4 text-base font-semibold text-white hover:bg-blue-800"
          >
            Continuar
          </button>
        </form>
      ) : (
        <MfaPrompt onVerificar={verificarMfa} onWebAuthn={tentarWebAuthn} erro={erroMfa} />
      )}
    </div>
  );
}
