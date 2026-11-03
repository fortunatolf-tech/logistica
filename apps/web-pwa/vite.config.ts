import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@rotaviva/shared-types": r("../../packages/shared-types/src/index.ts"),
      "@rotaviva/offline-core": r("../../packages/offline-core/src/index.ts"),
      "@rotaviva/ui-components": r("../../packages/ui-components/src/index.ts"),
    },
  },
  build: {
    target: "es2022",
    // Code splitting por tela via React.lazy (ver App.tsx).
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1/locations": "http://localhost:8001",
      "/v1/routes": "http://localhost:8002",
    },
  },
});
