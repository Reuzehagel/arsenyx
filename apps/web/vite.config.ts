import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: { port: 5173 },
  build: {
    // Main app-shell chunk is ~650KB; per-route code is already split out
    // via autoCodeSplitting. Vendor manualChunks were tried and reverted —
    // they only shuffle code into eager modulepreloads, growing first paint.
    chunkSizeWarningLimit: 700,
  },
})
