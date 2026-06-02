import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { FORMA_CALC_VERSION } from "@arsenyx/shared/warframe/forma"
import type { Polarity } from "@arsenyx/shared/warframe/types"
/**
 * Recompute & backfill the denormalized `formaCount` on every build.
 *
 * Forma count is a projection of buildData (slot forma polarities) + the item's
 * innate polarities (the game catalog). It's computed client-side at save time
 * and stored on the row so the list endpoint can show / sort it without shipping
 * buildData. This script is the re-runnable maintenance lever: after a forma
 * calc fix (bump FORMA_CALC_VERSION) or a catalog regeneration, run it to bring
 * stored counts back in line — touching only the rows that are stale.
 *
 * It reuses the EXACT `computeFormaCount` the editor uses (apps/web), so a
 * card's number can never drift from the detail page's.
 *
 * Lives in apps/web (not scripts/ or apps/api) because it needs both the web
 * calc — which only resolves under the web tsconfig's `@/` alias + DOM lib —
 * and a DB client. The api can't import apps/web (boundary), so this is the one
 * place the two meet. DB access mirrors apps/api/scripts/seed-admin.ts: the
 * Prisma client is workerd-only and won't load here, so we talk to Neon
 * directly via @neondatabase/serverless.
 *
 *   bun run recompute:forma              # dry run — reports diffs, writes nothing
 *   bun run recompute:forma --apply      # write the recomputed counts
 *   bun run recompute:forma --apply --all  # restamp every row, not just stale ones
 *
 * The `recompute:forma` package script wires `--env-file=../api/.env` so
 * DATABASE_URL resolves. Point that at a dev branch before --apply.
 */
import { neon } from "@neondatabase/serverless"

import { computeFormaCount } from "@/components/build-editor/forma-count"
import type { SlotId } from "@/components/build-editor/use-build-slots"
import type { BrowseCategory, DetailItem } from "@/lib/warframe"

const APPLY = process.argv.includes("--apply")
const ALL = process.argv.includes("--all")
const DATA_DIR = resolve(import.meta.dirname, "../public/data")

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL not set. Run via `bun run recompute:forma`, which loads ../api/.env.",
  )
  process.exit(1)
}

// --- catalog ---------------------------------------------------------------

/** Mirrors apps/web/vite.config.ts `dataVersion()` so the `catalogVersion`
 *  stamp this script writes matches what the client (`__DATA_VERSION__`)
 *  writes on save. */
function catalogVersion(): string {
  try {
    const meta = JSON.parse(
      readFileSync(resolve(DATA_DIR, "meta.json"), "utf8"),
    ) as { generatedAt?: string }
    const ts = Date.parse(meta.generatedAt ?? "")
    if (!Number.isNaN(ts)) return String(ts)
  } catch {
    // meta.json absent on a fresh checkout before build:items has run.
  }
  return "0"
}
const CATALOG_VERSION = catalogVersion()

// uniqueName -> { category dir, slug } from the lightweight index, so we can
// find each build's per-item detail JSON (which carries the innate polarities).
type IndexItem = { uniqueName: string; slug: string }
const index = JSON.parse(
  readFileSync(resolve(DATA_DIR, "items-index.json"), "utf8"),
) as Record<string, IndexItem[]>
const locator = new Map<string, { category: string; slug: string }>()
for (const [category, items] of Object.entries(index)) {
  for (const it of items)
    locator.set(it.uniqueName, { category, slug: it.slug })
}

const itemCache = new Map<string, DetailItem | null>()
function loadItem(uniqueName: string): DetailItem | null {
  const cached = itemCache.get(uniqueName)
  if (cached !== undefined) return cached
  const loc = locator.get(uniqueName)
  let item: DetailItem | null = null
  if (loc) {
    try {
      item = JSON.parse(
        readFileSync(
          resolve(DATA_DIR, "items", loc.category, `${loc.slug}.json`),
          "utf8",
        ),
      ) as DetailItem
    } catch {
      item = null
    }
  }
  itemCache.set(uniqueName, item)
  return item
}

// --- buildData -------------------------------------------------------------

function extractFormaPolarities(
  buildData: unknown,
): Partial<Record<SlotId, Polarity>> {
  if (!buildData || typeof buildData !== "object") return {}
  const fp = (buildData as Record<string, unknown>).formaPolarities
  if (!fp || typeof fp !== "object") return {}
  const out: Record<string, Polarity> = { ...(fp as Record<string, Polarity>) }
  // Legacy single-loadout builds keyed the aura slot "aura" before the
  // multi-aura migration renamed it "aura-0" (build-codec-adapter
  // migrateLegacyAuraKey). Normalize so the count matches the editor.
  if ("aura" in out && !("aura-0" in out)) {
    out["aura-0"] = out.aura!
    delete out.aura
  }
  return out as Partial<Record<SlotId, Polarity>>
}

// --- run -------------------------------------------------------------------

type Row = {
  id: string
  itemUniqueName: string
  itemCategory: string
  buildData: unknown
  formaCount: number
  formaCalcVersion: number
}

const sql = neon(DATABASE_URL)
const rows = (await sql`
  SELECT id, "itemUniqueName", "itemCategory", "buildData", "formaCount", "formaCalcVersion"
  FROM builds
`) as Row[]

let valueChanged = 0
let restamped = 0
let upToDate = 0
let missingItem = 0
let computeError = 0
const sample: string[] = []

for (const r of rows) {
  const item = loadItem(r.itemUniqueName)
  if (!item) {
    missingItem++
    continue
  }
  let next: number
  try {
    next = computeFormaCount(
      item,
      r.itemCategory as BrowseCategory,
      extractFormaPolarities(r.buildData),
    )
  } catch {
    computeError++
    continue
  }

  const diff = next !== r.formaCount
  const stale = r.formaCalcVersion !== FORMA_CALC_VERSION
  if (!ALL && !diff && !stale) {
    upToDate++
    continue
  }
  if (diff) {
    valueChanged++
    if (sample.length < 25) {
      sample.push(`  ${r.id}  ${item.name}: ${r.formaCount} → ${next}`)
    }
  } else {
    restamped++
  }

  if (APPLY) {
    await sql`
      UPDATE builds
      SET "formaCount" = ${next},
          "formaCalcVersion" = ${FORMA_CALC_VERSION},
          "catalogVersion" = ${CATALOG_VERSION}
      WHERE id = ${r.id}
    `
  }
}

const verb = APPLY ? "Updated" : "Would update"
console.log(
  `\nForma recompute — calc v${FORMA_CALC_VERSION}, catalog ${CATALOG_VERSION}`,
)
console.log(`  builds scanned:   ${rows.length}`)
console.log(`  value changed:    ${valueChanged}`)
console.log(
  `  restamped only:   ${restamped} (count already correct, version bumped)`,
)
console.log(`  already current:  ${upToDate}`)
if (missingItem) console.log(`  item not in catalog (skipped): ${missingItem}`)
if (computeError) console.log(`  compute errors (skipped): ${computeError}`)
if (sample.length) {
  console.log(`\nSample value changes:`)
  console.log(sample.join("\n"))
}
console.log(`\n${verb} ${valueChanged + restamped} rows.`)
if (!APPLY)
  console.log("Dry run — nothing written. Re-run with --apply to write.")
