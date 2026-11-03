import { useState, type ReactNode } from "react";

export type AbaLocalizacao = "foto" | "gps" | "plus_code" | "endereco";

export interface LocationPickerTabsProps {
  abaInicial?: AbaLocalizacao;
  aoMudarAba?: (aba: AbaLocalizacao) => void;
  conteudo: Record<AbaLocalizacao, ReactNode>;
}

const ABAS: Array<{ id: AbaLocalizacao; rotulo: string }> = [
  { id: "foto", rotulo: "Foto" },
  { id: "gps", rotulo: "GPS" },
  { id: "plus_code", rotulo: "Plus Code" },
  { id: "endereco", rotulo: "Endereço" },
];

/** Quatro formas de coletar localização (Bloco 4, tela de coleta). */
export function LocationPickerTabs({
  abaInicial = "gps",
  aoMudarAba,
  conteudo,
}: LocationPickerTabsProps) {
  const [ativa, setAtiva] = useState<AbaLocalizacao>(abaInicial);

  function selecionar(aba: AbaLocalizacao) {
    setAtiva(aba);
    aoMudarAba?.(aba);
  }

  function aoTeclar(e: React.KeyboardEvent, indice: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const proxima = (indice + delta + ABAS.length) % ABAS.length;
    const aba = ABAS[proxima];
    if (aba) selecionar(aba.id);
  }

  return (
    <div>
      <div role="tablist" aria-label="Forma de coleta da localização" className="flex gap-1">
        {ABAS.map((aba, i) => (
          <button
            key={aba.id}
            role="tab"
            id={`aba-${aba.id}`}
            aria-selected={ativa === aba.id}
            aria-controls={`painel-${aba.id}`}
            tabIndex={ativa === aba.id ? 0 : -1}
            onClick={() => selecionar(aba.id)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={[
              "min-h-11 flex-1 rounded-t-lg px-2 text-base font-medium",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
              ativa === aba.id
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200",
            ].join(" ")}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>
      {ABAS.map((aba) => (
        <div
          key={aba.id}
          role="tabpanel"
          id={`painel-${aba.id}`}
          aria-labelledby={`aba-${aba.id}`}
          hidden={ativa !== aba.id}
          className="rounded-b-lg border border-gray-200 bg-white p-4"
        >
          {conteudo[aba.id]}
        </div>
      ))}
    </div>
  );
}
