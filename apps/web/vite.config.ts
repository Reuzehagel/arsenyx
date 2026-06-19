import { readFileSync } from "node:fs"
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

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

/** Emit /sitemap.xml at build time from the committed catalog. Item pages are
 * the bulk of the indexable surface (~850 URLs) and Google discovers a
 * JS-rendered SPA slowly without one. Reads the same items-index.json the app
 * serves, so the sitemap can never drift from the deployed catalog. Public
 * build pages are intentionally absent — they live in Postgres, not the
 * catalog; crawlers reach them through on-site links. */
function sitemap(): Plugin {
  const SITE_URL = "https://www.arsenyx.com"
  const STATIC_PATHS = [
    "/",
    "/builds",
    "/orgs",
    "/about",
    "/docs",
    "/docs/api",
    "/changelog",
    "/privacy",
    "/terms",
  ]
  return {
    name: "arsenyx:sitemap",
    apply: "build",
    generateBundle() {
      let index: Record<string, { slug: string }[]> = {}
      let lastmod: string | undefined
      try {
        index = JSON.parse(
          readFileSync(
            path.resolve(import.meta.dirname, "public/data/items-index.json"),
            "utf8",
          ),
        )
        const version = Number(dataVersion()) // epoch ms of meta.json generatedAt
        if (version > 0) lastmod = new Date(version).toISOString().slice(0, 10)
      } catch {
        // Fresh checkout before build:items — ship the static URLs only.
      }

      const urls: string[] = STATIC_PATHS.map(
        (p) => `<url><loc>${SITE_URL}${p}</loc></url>`,
      )
      for (const [category, items] of Object.entries(index)) {
        urls.push(
          `<url><loc>${SITE_URL}/browse?category=${category}</loc></url>`.replace(
            /&/g,
            "&amp;",
          ),
        )
        for (const item of items) {
          const mod = lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
          urls.push(
            `<url><loc>${SITE_URL}/browse/${category}/${item.slug}</loc>${mod}</url>`,
          )
        }
      }

      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
      })
    },
  }
}

/** Emit /version.json holding the SPA's content-hashed entry filename. The
 * app-update hook (lib/hooks/use-app-update.ts) polls this tiny file to detect
 * new deploys — a code change ships a new entry hash, so the file's `entry`
 * differs from the one the running tab loaded with. It's a plain static asset
 * (excluded from `run_worker_first` in wrangler.toml, short-TTL in
 * public/_headers), so each poll is a cheap CDN 304 with ZERO Worker
 * invocations — unlike polling `/index.html`, which ran the edge Worker and
 * 307-redirected (two hits per poll). */
function versionFile(): Plugin {
  return {
    name: "arsenyx:version-file",
    apply: "build",
    generateBundle(_options, bundle) {
      const main = Object.values(bundle).find(
        (c) => c.type === "chunk" && c.isEntry && c.name === "main",
      )
      // Fail the build rather than ship {entry:null}: a silent null would
      // disable update detection for every client with no other signal.
      // `this.error` throws (aborts the build); `this.warn` would only log and
      // still emit the broken file. Fires if the `main` rollup input key
      // (build.rollupOptions.input) is ever renamed.
      if (!main) {
        this.error(
          "versionFile: no `main` entry chunk found; /version.json won't detect deploys",
        )
      }
      // `entry` mirrors the `src` Vite injects into index.html (base "/").
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify({ entry: `/${main.fileName}` })}\n`,
      })
    },
  }
}

export default defineConfig({
  define: {
    __DATA_VERSION__: JSON.stringify(dataVersion()),
  },
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    sitemap(),
    versionFile(),
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
