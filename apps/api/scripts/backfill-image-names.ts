/**
 * Backfill stale `imageName` values in every `Build` row.
 *
 * Older builds were saved when `@wfcd/items` shipped content-hashed image
 * filenames (e.g. `roar-e206197372.png`). Newer wfcd uses canonical names
 * (`RhinoRadialBlast.png`), and the upstream CDN no longer maps the old
 * hashed slugs — they 404. This script walks every build, looks each
 * `uniqueName` up in current static data under `apps/web/public/data/`, and
 * rewrites both `Build.itemImageName` (column) and every `imageName` nested
 * inside `Build.buildData` (mods, arcanes, helminth ability, plus legacy
 * `itemImageName` at the JSON root).
 *
 * Idempotent. Safe to re-run after `bun run build:items`.
 *
 * Usage:
 *   cd apps/api
 *   bun --env-file=.env run scripts/backfill-image-names.ts          # dry run
 *   bun --env-file=.env run scripts/backfill-image-names.ts --apply  # actually write
 */

import "dotenv/config"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { neon } from "@neondatabase/serverless"

const APPLY = process.argv.includes("--apply")
const DATA_DIR = resolve(import.meta.dirname, "../../web/public/data")

type Lookup = Map<string, string | undefined>

interface BrowseItem {
  uniqueName: string
  imageName?: string
}
interface ModLike {
  uniqueName: string
  imageName?: string
}
interface HelminthAbility {
  uniqueName: string
  imageName?: string
}

async function loadLookup<T extends { uniqueName: string; imageName?: string }>(
  file: string,
): Promise<Lookup> {
  const body = await readFile(resolve(DATA_DIR, file), "utf8")
  const list = JSON.parse(body) as T[]
  const map: Lookup = new Map()
  for (const entry of list) {
    if (entry?.uniqueName) map.set(entry.uniqueName, entry.imageName)
  }
  return map
}

async function loadItemLookup(): Promise<Lookup> {
  const body = await readFile(resolve(DATA_DIR, "items-index.json"), "utf8")
  const raw = JSON.parse(body) as Record<string, BrowseItem[]>
  const map: Lookup = new Map()
  for (const list of Object.values(raw)) {
    for (const item of list ?? []) {
      if (item?.uniqueName) map.set(item.uniqueName, item.imageName)
    }
  }
  return map
}

interface Lookups {
  items: Lookup
  mods: Lookup
  arcanes: Lookup
  helminth: Lookup
}

async function loadAllLookups(): Promise<Lookups> {
  const [items, mods, arcanes, helminth] = await Promise.all([
    loadItemLookup(),
    loadLookup<ModLike>("mods-all.json"),
    loadLookup<ModLike>("arcanes-all.json"),
    loadLookup<HelminthAbility>("helminth-abilities.json"),
  ])
  return { items, mods, arcanes, helminth }
}

type RewriteKind = "mod" | "arcane" | "helminth" | "item"

interface RewriteStats {
  itemColumn: number
  itemRoot: number
  mods: number
  arcanes: number
  helminth: number
  unresolved: { kind: RewriteKind; uniqueName: string }[]
}

function rewriteImageName(
  obj: Record<string, unknown> | null | undefined,
  lookup: Lookup,
  kind: RewriteKind,
  stats: RewriteStats,
): boolean {
  if (!obj || typeof obj !== "object") return false
  const uniqueName = obj.uniqueName as string | undefined
  if (!uniqueName) return false
  const fresh = lookup.get(uniqueName)
  if (fresh === undefined) {
    if (obj.imageName) stats.unresolved.push({ kind, uniqueName })
    return false
  }
  if (obj.imageName === fresh) return false
  obj.imageName = fresh
  return true
}

function refreshBuildData(
  data: unknown,
  lookups: Lookups,
  stats: RewriteStats,
): { changed: boolean; data: unknown } {
  if (!data || typeof data !== "object") return { changed: false, data }
  const next = structuredClone(data) as Record<string, unknown>
  let changed = false

  // Legacy BuildState root: itemImageName lives on the JSON.
  if ("itemImageName" in next && typeof next.itemUniqueName === "string") {
    const fresh = lookups.items.get(next.itemUniqueName as string)
    if (fresh !== undefined && next.itemImageName !== fresh) {
      next.itemImageName = fresh
      stats.itemRoot++
      changed = true
    }
  }

  // Modern slot map (`slots[id]: { mod, rank }`)
  const slots = next.slots as
    | Record<string, { mod?: Record<string, unknown> } | undefined>
    | undefined
  if (slots) {
    for (const placed of Object.values(slots)) {
      if (
        placed?.mod &&
        rewriteImageName(placed.mod, lookups.mods, "mod", stats)
      ) {
        stats.mods++
        changed = true
      }
    }
  }

  // Legacy slot arrays (`auraSlots[]`, `normalSlots[]`) + singular `exilusSlot`
  const legacySlots: Array<{ mod?: Record<string, unknown> }> = []
  for (const key of ["auraSlots", "normalSlots"] as const) {
    const arr = next[key] as
      | Array<{ mod?: Record<string, unknown> }>
      | undefined
    if (Array.isArray(arr)) legacySlots.push(...arr)
  }
  const exilus = next.exilusSlot as
    | { mod?: Record<string, unknown> }
    | undefined
  if (exilus) legacySlots.push(exilus)
  for (const slot of legacySlots) {
    if (slot?.mod && rewriteImageName(slot.mod, lookups.mods, "mod", stats)) {
      stats.mods++
      changed = true
    }
  }

  // Modern arcane slots (`arcanes[]: { arcane, rank } | null`)
  const arcanes = next.arcanes as
    | Array<{ arcane?: Record<string, unknown> } | null>
    | undefined
  if (Array.isArray(arcanes)) {
    for (const placed of arcanes) {
      if (
        placed?.arcane &&
        rewriteImageName(placed.arcane, lookups.arcanes, "arcane", stats)
      ) {
        stats.arcanes++
        changed = true
      }
    }
  }

  // Legacy arcane slots (`arcaneSlots[]: SharedPlacedArcane | null`) — flat shape
  const legacyArcanes = next.arcaneSlots as
    | Array<Record<string, unknown> | null>
    | undefined
  if (Array.isArray(legacyArcanes)) {
    for (const a of legacyArcanes) {
      if (a && rewriteImageName(a, lookups.arcanes, "arcane", stats)) {
        stats.arcanes++
        changed = true
      }
    }
  }

  // Modern helminth (`helminth[slotIndex]: HelminthAbility`)
  const helminthMap = next.helminth as
    | Record<string, Record<string, unknown>>
    | undefined
  if (helminthMap) {
    for (const ability of Object.values(helminthMap)) {
      if (
        ability &&
        rewriteImageName(ability, lookups.helminth, "helminth", stats)
      ) {
        stats.helminth++
        changed = true
      }
    }
  }

  // Legacy helminth (`helminthAbility.ability`)
  const legacyHelminth = next.helminthAbility as
    | { ability?: Record<string, unknown> }
    | undefined
  if (
    legacyHelminth?.ability &&
    rewriteImageName(
      legacyHelminth.ability,
      lookups.helminth,
      "helminth",
      stats,
    )
  ) {
    stats.helminth++
    changed = true
  }

  return { changed, data: next }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")
  const sql = neon(process.env.DATABASE_URL)

  const lookups = await loadAllLookups()
  console.log(
    `Loaded lookups: ${lookups.items.size} items, ${lookups.mods.size} mods, ` +
      `${lookups.arcanes.size} arcanes, ${lookups.helminth.size} helminth abilities`,
  )

  const builds = (await sql`
    SELECT id, slug, "itemUniqueName", "itemImageName", "buildData"
    FROM builds
  `) as Array<{
    id: string
    slug: string
    itemUniqueName: string
    itemImageName: string | null
    buildData: unknown
  }>

  console.log(`Scanning ${builds.length} builds (apply=${APPLY})…`)

  const stats: RewriteStats = {
    itemColumn: 0,
    itemRoot: 0,
    mods: 0,
    arcanes: 0,
    helminth: 0,
    unresolved: [],
  }
  let buildsChanged = 0

  for (const b of builds) {
    const freshItemImage = lookups.items.get(b.itemUniqueName)
    const itemColumnChanged =
      freshItemImage !== undefined && b.itemImageName !== freshItemImage
    const { changed: dataChanged, data: nextData } = refreshBuildData(
      b.buildData,
      lookups,
      stats,
    )
    if (!itemColumnChanged && !dataChanged) continue
    buildsChanged++
    if (itemColumnChanged) stats.itemColumn++
    if (APPLY) {
      await sql`
        UPDATE builds
        SET "itemImageName" = ${freshItemImage ?? b.itemImageName},
            "buildData" = ${JSON.stringify(nextData)}::jsonb
        WHERE id = ${b.id}
      `
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Builds touched: ${buildsChanged} / ${builds.length}`)
  console.log(`  itemImageName column rewrites: ${stats.itemColumn}`)
  console.log(`  buildData root itemImageName:  ${stats.itemRoot}`)
  console.log(`  mod imageName rewrites:        ${stats.mods}`)
  console.log(`  arcane imageName rewrites:     ${stats.arcanes}`)
  console.log(`  helminth imageName rewrites:   ${stats.helminth}`)
  if (stats.unresolved.length > 0) {
    const counts = new Map<string, number>()
    for (const u of stats.unresolved) {
      const k = `${u.kind}:${u.uniqueName}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    console.log(
      `\nUnresolved uniqueNames (left as-is): ${stats.unresolved.length}`,
    )
    for (const [k, n] of [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)) {
      console.log(`  ${n}× ${k}`)
    }
  }
  console.log(APPLY ? "\nApplied." : "\nDry run. Pass --apply to write.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
