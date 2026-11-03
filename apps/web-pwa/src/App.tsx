import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { OfflineBanner, SyncIndicator } from "@rotaviva/ui-components";
import { criarClienteOffline, type ClienteOffline } from "./offline";

// Code splitting: cada tela vira um chunk separado (Bloco 4, item 4).
const LoginScreen = lazy(() => import("./screens/LoginScreen"));
const DeliveriesScreen = lazy(() => import("./screens/DeliveriesScreen"));
const CaptureScreen = lazy(() => import("./screens/CaptureScreen"));
const RouteScreen = lazy(() => import("./screens/RouteScreen"));
const ConfirmScreen = lazy(() => import("./screens/ConfirmScreen"));
const DashboardScreen = lazy(() => import("./screens/DashboardScreen"));
const TitularScreen = lazy(() => import("./screens/TitularScreen"));

const OfflineContext = createContext<ClienteOffline | null>(null);

export function useOffline(): ClienteOffline {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("ClienteOffline não inicializado");
  return ctx;
}

function useHashRoute(): [string, (rota: string) => void] {
  const [rota, setRota] = useState(() => window.location.hash.slice(1) || "/login");
  useEffect(() => {
    const aoMudar = () => setRota(window.location.hash.slice(1) || "/login");
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  return [rota, (r) => (window.location.hash = r)];
}

export function App(): ReactNode {
  const [cliente, setCliente] = useState<ClienteOffline | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendentes, setPendentes] = useState(0);
  const [rota, navegar] = useHashRoute();

  useEffect(() => {
    void criarClienteOffline().then(setCliente);
  }, []);

  useEffect(() => {
    const aoOnline = () => setOnline(true);
    const aoOffline = () => setOnline(false);
    window.addEventListener("online", aoOnline);
    window.addEventListener("offline", aoOffline);
    return () => {
      window.removeEventListener("online", aoOnline);
      window.removeEventListener("offline", aoOffline);
    };
  }, []);

  // Contagem de pendentes para o SyncIndicator (leve: 2 s).
  useEffect(() => {
    if (!cliente) return;
    const timer = setInterval(() => {
      void cliente.fila.pendentes().then((p) => setPendentes(p.length));
    }, 2000);
    return () => clearInterval(timer);
  }, [cliente]);

  const telas: Record<string, ReactNode> = {
    "/login": <LoginScreen onEntrar={() => navegar("/entregas")} />,
    "/entregas": <DeliveriesScreen navegar={navegar} />,
    "/coleta": <CaptureScreen navegar={navegar} />,
    "/rota": <RouteScreen navegar={navegar} />,
    "/confirmar": <ConfirmScreen navegar={navegar} />,
    "/dashboard": <DashboardScreen />,
    "/titular": <TitularScreen />,
  };

  return (
    <OfflineContext.Provider value={cliente}>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col md:max-w-4xl">
        <OfflineBanner visivel={!online} pendentes={pendentes} />
        <header className="flex min-h-11 items-center justify-between bg-blue-700 px-4 py-2 text-white">
          <h1 className="text-lg font-bold">
            <a href="#/entregas" className="focus-visible:outline-2 focus-visible:outline-white">
              RotaViva
            </a>
          </h1>
          <SyncIndicator
            status={!online ? "offline" : pendentes > 0 ? "pendente" : "sincronizado"}
            pendentes={pendentes}
          />
        </header>
        <main className="flex-1 p-4">
          <Suspense fallback={<p className="text-base">Carregando…</p>}>
            {telas[rota] ?? telas["/login"]}
          </Suspense>
        </main>
        {rota !== "/login" && (
          <nav
            aria-label="Navegação principal"
            className="flex border-t border-gray-200 bg-white"
          >
            {(
              [
                ["/entregas", "Entregas"],
                ["/rota", "Rota"],
                ["/coleta", "Coleta"],
                ["/dashboard", "Gestão"],
              ] as const
            ).map(([destino, rotulo]) => (
              <a
                key={destino}
                href={`#${destino}`}
                aria-current={rota === destino ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center text-base font-medium ${
                  rota === destino ? "text-blue-700" : "text-gray-600"
                }`}
              >
                {rotulo}
              </a>
            ))}
          </nav>
        )}
      </div>
    </OfflineContext.Provider>
  );
}
