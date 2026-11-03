import { useState, type ReactNode } from "react";
import { LocationPickerTabs } from "@rotaviva/ui-components";
import { useOffline } from "../App";

/**
 * Coleta de localização nas quatro formas (Bloco 2/4). Online chama o
 * geo-normalizer; offline (ou em falha) enfileira a mutação para sync.
 */
export default function CaptureScreen({
  navegar,
}: {
  navegar: (rota: string) => void;
}): ReactNode {
  const { fila } = useOffline();
  const [plusCode, setPlusCode] = useState("");
  const [endereco, setEndereco] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function enviar(payload: Record<string, unknown>) {
    const idempotency_key = crypto.randomUUID();
    try {
      const resp = await fetch("/v1/locations/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotency_key }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setMensagem("Localização normalizada e registrada.");
    } catch {
      // Offline ou falha: enfileira — o SyncEngine entrega depois.
      await fila.enfileirar({
        idempotency_key,
        entidade: "location",
        operacao: "criar",
        payload,
      });
      setMensagem("Sem conexão: localização enfileirada para sincronizar depois.");
    }
  }

  function coletarGps() {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        void enviar({
          fonte: "gps",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao_m: pos.coords.accuracy,
        }),
      () => setMensagem("Não foi possível obter o GPS do dispositivo."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <section aria-labelledby="titulo-coleta">
      <h2 id="titulo-coleta" className="text-lg font-semibold">
        Coletar localização
      </h2>
      <div className="mt-3">
        <LocationPickerTabs
          conteudo={{
            foto: (
              <label className="block text-base">
                Foto com geotag (EXIF)
                <input
                  type="file"
                  accept="image/jpeg,image/heic"
                  capture="environment"
                  className="mt-1 block w-full text-base"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (!arquivo) return;
                    void arquivo.arrayBuffer().then((buf) => {
                      const bytes = new Uint8Array(buf);
                      let bin = "";
                      for (const b of bytes) bin += String.fromCharCode(b);
                      void enviar({ fonte: "exif", foto_base64: btoa(bin) });
                    });
                  }}
                />
              </label>
            ),
            gps: (
              <button
                type="button"
                onClick={coletarGps}
                className="min-h-11 w-full rounded-lg bg-blue-700 px-4 text-base font-semibold text-white"
              >
                Usar minha localização atual
              </button>
            ),
            plus_code: (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar({ fonte: "plus_code", plus_code: plusCode });
                }}
              >
                <label className="block text-base" htmlFor="plus-code">
                  Plus Code (completo ou curto)
                </label>
                <input
                  id="plus-code"
                  value={plusCode}
                  onChange={(e) => setPlusCode(e.target.value)}
                  placeholder="588MC9X8+QM"
                  className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
                />
                <button
                  type="submit"
                  className="mt-2 min-h-11 w-full rounded-lg bg-blue-700 px-4 text-base font-semibold text-white"
                >
                  Normalizar
                </button>
              </form>
            ),
            endereco: (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar({ fonte: "endereco", endereco });
                }}
              >
                <label className="block text-base" htmlFor="endereco">
                  Endereço completo
                </label>
                <input
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                  className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
                />
                <button
                  type="submit"
                  className="mt-2 min-h-11 w-full rounded-lg bg-blue-700 px-4 text-base font-semibold text-white"
                >
                  Normalizar
                </button>
              </form>
            ),
          }}
        />
      </div>
      {mensagem && (
        <p role="status" className="mt-3 text-base text-gray-800">
          {mensagem}
        </p>
      )}
      <button
        type="button"
        onClick={() => navegar("/entregas")}
        className="mt-4 min-h-11 text-base text-blue-700 underline"
      >
        Voltar para entregas
      </button>
    </section>
  );
}
