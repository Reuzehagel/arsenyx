import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { SlotId } from "@arsenyx/shared/warframe/build-data"
import {
  CATALOG_FILES,
  dataVersionFromMeta,
  ITEM_DETAIL_DIR,
} from "@arsenyx/shared/warframe/catalog-files"
import { FORMA_CALC_VERSION } from "@arsenyx/shared/warframe/forma"
import type { Polarity, BrowseCategory } from "@arsenyx/shared/warframe/types"
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
 * Prisma client is workerd-only and won't load here, so we talk to Postgres
 * directly via `pg`, which reaches both the Neon dev copy and PlanetScale prod.
 *
 *   bun run recompute:forma              # dry run — reports diffs, writes nothing
 *   bun run recompute:forma --apply      # write the recomputed counts
 *   bun run recompute:forma --apply --all  # restamp every row, not just stale ones
 *
 * The `recompute:forma` package script wires `--env-file=../api/.env` so
 * DATABASE_URL resolves to the Neon dev copy. To run against prod, override
 * it on the command line — `DATABASE_URL=<planetscale url> bun run …` — and
 * dry-run first.
 */
import { Client } from "pg"

import { computeFormaCount } from "@/lib/build/forma-count"
import type { DetailItem } from "@/lib/catalog"

import { CATALOG_DIR, REPO_ROOT } from "../../../scripts/build/paths"

const APPLY = process.argv.includes("--apply")
const ALL = process.argv.includes("--all")
const DATA_DIR = resolve(REPO_ROOT, CATALOG_DIR)

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL not set. Run via `bun run recompute:forma`, which loads ../api/.env.",
  )
  process.exit(1)
}

// --- catalog ---------------------------------------------------------------

// Same derivation as vite.config.ts, so the stamp matches what the client
// (`__DATA_VERSION__`) writes on save.
const metaPath = resolve(DATA_DIR, CATALOG_FILES.meta)
const CATALOG_VERSION = dataVersionFromMeta(
  existsSync(metaPath) ? readFileSync(metaPath, "utf8") : undefined,
)

// uniqueName -> { category dir, slug } from the lightweight index, so we can
// find each build's per-item detail JSON (which carries the innate polarities).
type IndexItem = { uniqueName: string; slug: string }
const index = JSON.parse(
  readFileSync(resolve(DATA_DIR, CATALOG_FILES.itemsIndex), "utf8"),
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
          resolve(DATA_DIR, ITEM_DETAIL_DIR, loc.category, `${loc.slug}.json`),
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

/** The twin-frame form whose innates the count is against — the editor's:
 *  the top-level mirror of the variant active at save time. Docs saved before
 *  the editor wrote that mirror fall back to the first variant's. */
function extractFormIndex(buildData: unknown): number {
  const data = buildData as {
    formIndex?: unknown
    variants?: { formIndex?: unknown }[]
  } | null
  const fi = data?.formIndex ?? data?.variants?.[0]?.formIndex
  return typeof fi === "number" && Number.isInteger(fi) && fi >= 0 ? fi : 0
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

// Strip libpq-only params node's `pg` can't honour (see seed-admin.ts):
// `sslrootcert=system` would readFileSync("system"). TLS is verified against
// Node's built-in CA bundle, which covers both Neon and PlanetScale.
const dbUrl = new URL(DATABASE_URL)
const sslmode = dbUrl.searchParams.get("sslmode") ?? "require"
dbUrl.searchParams.delete("sslrootcert")
dbUrl.searchParams.delete("sslnegotiation")
const client = new Client({
  connectionString: dbUrl.toString(),
  ssl: sslmode === "disable" ? false : { rejectUnauthorized: true },
})
await client.connect()
console.log(`Connected to ${dbUrl.hostname}`)

// Tagged-template helper: sql`… ${a} …` → parameterised query ($1, …), rows.
const sql = async (
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<unknown[]> => {
  const text = strings.reduce(
    (acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""),
    "",
  )
  const { rows } = await client.query(text, values)
  return rows
}

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
    // Highest count across the top-level set and every variant's own set —
    // independent variants each carry their own forma (matches the editor save).
    const variants = (r.buildData as { variants?: unknown } | null)?.variants
    next = Math.max(
      ...[r.buildData, ...(Array.isArray(variants) ? variants : [])].map((d) =>
        computeFormaCount(
          item,
          r.itemCategory as BrowseCategory,
          extractFormaPolarities(d),
          extractFormIndex(r.buildData),
        ),
      ),
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

await client.end()
