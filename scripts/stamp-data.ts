/**
 * Bump `apps/web/public/data/meta.json`'s `generatedAt` to now.
 *
 * The catalog under `apps/web/public/data/` is served `immutable, max-age=1yr`
 * under stable URLs; the app cache-busts via `?v=<generatedAt>` (see
 * vite.config.ts `dataVersion()`). A full `data:refresh` stamps this for free
 * (build:items writes a fresh `generatedAt`), but a *hand-edit* to the catalog
 * — a quick one-off data fix — leaves `generatedAt` untouched, so every client
 * that cached the old bytes never refetches. Run this after any manual catalog
 * edit. `check:data-version` enforces it in CI.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const META = resolve(import.meta.dirname, "../apps/web/public/data/meta.json")

const meta = JSON.parse(readFileSync(META, "utf8")) as { generatedAt: string }
const prev = meta.generatedAt
meta.generatedAt = new Date().toISOString()
// Match build-items-index.ts exactly: 2-space indent, no trailing newline —
// otherwise the stamp introduces a spurious whitespace diff.
writeFileSync(META, JSON.stringify(meta, null, 2))

console.log(`✓ data:stamp — generatedAt ${prev} → ${meta.generatedAt}`)
