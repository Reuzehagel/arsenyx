/**
 * Bump `apps/web/public/data/meta.json`'s `generatedAt` to now and recompute its
 * record counts.
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

const DATA = resolve(import.meta.dirname, "../apps/web/public/data")
const META = resolve(DATA, "meta.json")
const read = (f: string) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"))

const meta = read("meta.json") as {
  generatedAt: string
  itemCount: number
  modCount: number
  arcaneCount: number
  perCategory: Record<string, number>
}
const prev = meta.generatedAt
meta.generatedAt = new Date().toISOString()
// data:patch skips meta.json, so a patch that adds or drops records leaves the
// counts stale — recompute them from the emitted files.
const index = read("items-index.json") as Record<string, unknown[]>
for (const [cat, items] of Object.entries(index))
  meta.perCategory[cat] = items.length
meta.itemCount = Object.values(meta.perCategory).reduce((a, b) => a + b, 0)
meta.modCount = read("mods-all.json").length
meta.arcaneCount = read("arcanes-all.json").length
// Match build-items-index.ts exactly: 2-space indent, no trailing newline —
// otherwise the stamp introduces a spurious whitespace diff.
writeFileSync(META, JSON.stringify(meta, null, 2))

console.log(`✓ data:stamp — generatedAt ${prev} → ${meta.generatedAt}`)
