import { readFileSync } from "node:fs"
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/** Stamp the static-data version into the bundle so `/data/` fetches can append
 * `?v=` and the CDN can cache them `immutable` (see lib/queries/static-data-query.ts
 * and public/_headers). Derived from the committed catalog's `generatedAt`, so it
 * only changes when the data pipeline regenerates — a frontend-only rebuild keeps
 * the same version and doesn't needlessly bust the cache. */
function dataVersion(): string {
  try {
    const meta = JSON.parse(
      readFileSync(
        path.resolve(import.meta.dirname, "public/data/meta.json"),
        "utf8",
      ),
    ) as { generatedAt?: string }
    const ts = Date.parse(meta.generatedAt ?? "")
    if (!Number.isNaN(ts)) return String(ts)
  } catch {
    // meta.json absent on a fresh checkout before build:items has run.
  }
  return "0"
}

export default defineConfig({
  define: {
    __DATA_VERSION__: JSON.stringify(dataVersion()),
  },
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
