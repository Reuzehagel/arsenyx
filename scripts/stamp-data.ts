/**
 * Bump `apps/web/public/data/meta.json`'s `generatedAt` to now and recompute its
 * record counts (honors CATALOG_OUT_DIR, like build:items).
 *
 * The catalog under `apps/web/public/data/` is served `immutable, max-age=1yr`
 * under stable URLs; the app cache-busts via `?v=<generatedAt>` (see
 * vite.config.ts `dataVersion()`). A full `data:refresh` stamps this for free
 * (build:items writes a fresh `generatedAt`), but a *hand-edit* to the catalog
 * — a quick one-off data fix — leaves `generatedAt` untouched, so every client
 * that cached the old bytes never refetches. Run this after any manual catalog
 * edit. `check:data-version` enforces it in CI.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { CATALOG_FILES } from "@arsenyx/shared/warframe/catalog-files"

import { countsFromCatalog, writeMeta } from "./build/meta"
import { CATALOG_OUT_DIR as DATA } from "./build/paths"

const read = (f: string) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"))

const prev = (read(CATALOG_FILES.meta) as { generatedAt: string }).generatedAt
// data:patch skips meta.json, so a patch that adds or drops records leaves the
// counts stale — recompute them from the emitted files.
const meta = await writeMeta(
  DATA,
  countsFromCatalog(
    read(CATALOG_FILES.itemsIndex),
    read(CATALOG_FILES.mods),
    read(CATALOG_FILES.arcanes),
  ),
)

console.log(`✓ data:stamp — generatedAt ${prev} → ${meta.generatedAt}`)
