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
    rollupOptions: {
      // Two entries: the full SPA (index.html) and a lightweight read-only
      // viewer (embed.html → src/embed-main.tsx) the Worker serves for
      // `/builds/:slug?embed=1`. The embed entry has its own (much smaller)
      // chunk graph — no router, no route tree, no app chrome — so a guide
      // page's many iframes don't each boot the whole app.
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        embed: path.resolve(import.meta.dirname, "embed.html"),
      },
    },
  },
})
