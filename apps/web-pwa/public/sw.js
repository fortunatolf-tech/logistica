/// <reference lib="webworker" />
/**
 * Service Worker do RotaViva (Bloco 4, itens 3 e 4).
 *
 * - Precache do app shell; assets com hash servidos cache-first;
 * - Navegação network-first com fallback offline para "/";
 * - Background Sync: repassa o evento para as abas abertas, que drenam
 *   a fila de mutações (o IndexedDB vive no contexto da página).
 */

const CACHE_SHELL = "rotaviva-shell-v1";
const CACHE_ASSETS = "rotaviva-assets-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) => cache.addAll(["/", "/index.html"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Chamadas de API: network-only (a fila offline trata as escritas).
  if (url.pathname.startsWith("/v1/")) return;

  // Assets com hash do Vite: cache-first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((resp) => {
            const clone = resp.clone();
            caches.open(CACHE_ASSETS).then((cache) => cache.put(request, clone));
            return resp;
          }),
      ),
    );
    return;
  }

  // Navegação: network-first com fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_SHELL).then((cache) => cache.put("/", clone));
          return resp;
        })
        .catch(() => caches.match("/").then((hit) => hit ?? Response.error())),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "rotaviva-sync") return;
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      for (const client of clients) client.postMessage({ tipo: "rotaviva-sync" });
    }),
  );
});
