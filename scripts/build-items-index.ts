/**
 * Precompute static browse data.
 *
 *  1. `items-index.json` — every browseable item as a card payload.
 *  2. `items/<category>/<slug>.json` — one file per item, full WFCD object,
 *     consumed by the detail page.
 *
 * Reads raw WFCD JSON directly from the `@wfcd/items` package.
 *
 * Run: `bun run build:items`
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"

import { normalizeArcanes } from "@arsenyx/shared/warframe/arcanes"
import { BROWSE_CATEGORIES } from "@arsenyx/shared/warframe/categories"
import { buildIndex } from "@arsenyx/shared/warframe/categorize"
import {
  INCARNON_GENESIS_IMAGES,
  INCARNON_NAMES,
} from "@arsenyx/shared/warframe/incarnon-data"
import { INCARNON_EVOLUTIONS } from "@arsenyx/shared/warframe/incarnon-evolutions"
import { normalizeMods } from "@arsenyx/shared/warframe/mods"
import {
  slimArcanesForClient,
  slimItemForClient,
  slimModsForClient,
} from "@arsenyx/shared/warframe/slim"
import type {
  Arcane,
  BrowseableItem,
  BrowseCategory,
  BrowseItem,
  Mod,
} from "@arsenyx/shared/warframe/types"

const require = createRequire(import.meta.url)
const WFCD_PKG = dirname(require.resolve("@wfcd/items/package.json"))
const WFCD_JSON = resolve(WFCD_PKG, "data/json")

// WFCD files that contribute browseable items.
const DATA_FILES = [
  "Warframes.json",
  "Primary.json",
  "Secondary.json",
  "Melee.json",
  "Sentinels.json",
  "Pets.json",
  "SentinelWeapons.json",
  "Misc.json",
  "Archwing.json",
  "Arch-Gun.json",
  "Arch-Melee.json",
] as const

const REPO = resolve(import.meta.dirname, "..")
const PUBLIC_DATA = resolve(REPO, "apps/web/public/data")
const INDEX_OUT = resolve(PUBLIC_DATA, "items-index.json")
const DETAIL_DIR = resolve(PUBLIC_DATA, "items")
const MODS_OUT = resolve(PUBLIC_DATA, "mods-all.json")
const ARCANES_OUT = resolve(PUBLIC_DATA, "arcanes-all.json")
const HELMINTH_OUT = resolve(PUBLIC_DATA, "helminth-abilities.json")
const INCARNON_OUT = resolve(PUBLIC_DATA, "incarnon-evolutions.json")
const META_OUT = resolve(PUBLIC_DATA, "meta.json")

async function readWfcdMeta(): Promise<{
  packageVersion: string
  gameUpdate: string | null
}> {
  const pkg = JSON.parse(
    await readFile(resolve(WFCD_PKG, "package.json"), "utf8"),
  ) as { version: string }
  let gameUpdate: string | null = null
  try {
    const readme = await readFile(resolve(WFCD_PKG, "README.md"), "utf8")
    // Badge format: warframe_update-<version>-<color>.svg
    const match = readme.match(/warframe_update-([\d.]+)-[a-z]+\.svg/i)
    if (match) gameUpdate = match[1] ?? null
  } catch {
    // README missing — just skip
  }
  return { packageVersion: pkg.version, gameUpdate }
}

// Warframe → subsumed ability name. Mirrors legacy/src/lib/warframe/helminth.ts.
const SUBSUMABLE_ABILITIES: Record<string, string> = {
  Ash: "Shuriken",
  Atlas: "Petrify",
  Banshee: "Silence",
  Baruuk: "Lull",
  Caliban: "Sentient Wrath",
  Citrine: "Fractured Blast",
  Chroma: "Elemental Ward",
  "Cyte-09": "Evade",
  Dagath: "Wyrd Scythes",
  Dante: "Dark Verse",
  Ember: "Fire Blast",
  Equinox: "Rest & Rage",
  Excalibur: "Radial Blind",
  Frost: "Ice Wave",
  Gara: "Spectrorage",
  Garuda: "Blood Altar",
  Gauss: "Thermal Sunder",
  Grendel: "Nourish",
  Gyre: "Coil Horizon",
  Harrow: "Condemn",
  Hildryn: "Pillage",
  Hydroid: "Tempest Barrage",
  Inaros: "Desiccation",
  Ivara: "Quiver",
  Jade: "Ophanim Eyes",
  Khora: "Ensnare",
  Koumei: "Omamori",
  Kullervo: "Wrathful Advance",
  Lavos: "Vial Rush",
  Limbo: "Banish",
  Loki: "Decoy",
  Mag: "Pull",
  Mesa: "Shooting Gallery",
  Mirage: "Eclipse",
  Nekros: "Terrify",
  Nezha: "Fire Walker",
  Nidus: "Larva",
  Nokko: "Brightbonnet",
  Nova: "Null Star",
  Nyx: "Mind Control",
  Oberon: "Smite",
  Octavia: "Resonator",
  Oraxia: "Webbed Embrace",
  Protea: "Dispensary",
  Qorvex: "Chyrinka Pillar",
  Revenant: "Reave",
  Rhino: "Roar",
  Saryn: "Molt",
  Sevagoth: "Gloom",
  Styanax: "Tharros Strike",
  Temple: "Pyrotechnics",
  Titania: "Spellbind",
  Trinity: "Well of Life",
  Uriel: "Remedium",
  Valkyr: "Warcry",
  Vauban: "Tesla Nervos",
  Volt: "Shock",
  Voruna: "Lycath's Hunt",
  Wisp: "Breach Surge",
  Wukong: "Defy",
  Xaku: "Xata's Whisper",
  Yareli: "Aquablades",
  Zephyr: "Airburst",
}

interface HelminthAbility {
  uniqueName: string
  name: string
  imageName?: string
  description: string
  source: string
}

type MaybeWarframe = {
  name: string
  abilities?: Array<{
    uniqueName: string
    name: string
    imageName?: string
    description: string
  }>
}

function buildHelminthAbilities(allItems: BrowseableItem[]): HelminthAbility[] {
  const byName = new Map<string, MaybeWarframe>()
  for (const item of allItems as unknown as MaybeWarframe[]) {
    if (item.name && item.abilities) byName.set(item.name, item)
  }
  const out: HelminthAbility[] = []

  const helminth = byName.get("Helminth")
  if (helminth?.abilities) {
    for (const a of helminth.abilities) {
      out.push({ ...a, source: "Helminth" })
    }
  }

  for (const [frame, abilityName] of Object.entries(SUBSUMABLE_ABILITIES)) {
    const a = byName.get(frame)?.abilities?.find((x) => x.name === abilityName)
    if (a) out.push({ ...a, source: frame })
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

async function loadAllItems(): Promise<BrowseableItem[]> {
  const all: BrowseableItem[] = []
  for (const file of DATA_FILES) {
    const body = await readFile(resolve(WFCD_JSON, file), "utf8")
    const items = JSON.parse(body) as BrowseableItem[]
    all.push(...items)
  }
  return all
}

async function loadAllMods(): Promise<Mod[]> {
  const body = await readFile(resolve(WFCD_JSON, "Mods.json"), "utf8")
  return JSON.parse(body) as Mod[]
}

async function loadAllArcanes(): Promise<Arcane[]> {
  const body = await readFile(resolve(WFCD_JSON, "Arcanes.json"), "utf8")
  return JSON.parse(body) as Arcane[]
}

async function main() {
  const [allItems, rawMods, rawArcanes, wfcd] = await Promise.all([
    loadAllItems(),
    loadAllMods(),
    loadAllArcanes(),
    readWfcdMeta(),
  ])
  const mods = normalizeMods(rawMods)
  const arcanes = normalizeArcanes(rawArcanes)
  const { byCategory, slugLookup } = buildIndex(allItems)

  await mkdir(dirname(INDEX_OUT), { recursive: true })

  const indexPayload: Partial<Record<BrowseCategory, BrowseItem[]>> = {}
  for (const cat of BROWSE_CATEGORIES) {
    indexPayload[cat.id] = byCategory[cat.id] ?? []
  }
  const indexJson = JSON.stringify(indexPayload)
  await writeFile(INDEX_OUT, indexJson, "utf8")

  const totalItems = Object.values(indexPayload).reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0,
  )
  const indexKb = (Buffer.byteLength(indexJson, "utf8") / 1024).toFixed(1)
  console.log(
    `✓ wrote ${totalItems} items across ${BROWSE_CATEGORIES.length} categories → items-index.json (${indexKb} KB)`,
  )

  await rm(DETAIL_DIR, { recursive: true, force: true })
  await mkdir(DETAIL_DIR, { recursive: true })

  let detailCount = 0
  let detailBytes = 0
  for (const cat of BROWSE_CATEGORIES) {
    const catDir = resolve(DETAIL_DIR, cat.id)
    await mkdir(catDir, { recursive: true })
    for (const slim of byCategory[cat.id] ?? []) {
      const full = slugLookup.get(`${cat.id}|${slim.slug}`)
      if (!full) continue
      const body = JSON.stringify(slimItemForClient(full))
      await writeFile(resolve(catDir, `${slim.slug}.json`), body, "utf8")
      detailCount++
      detailBytes += Buffer.byteLength(body, "utf8")
    }
  }
  const detailMb = (detailBytes / 1024 / 1024).toFixed(2)
  console.log(
    `✓ wrote ${detailCount} per-item detail files → items/ (${detailMb} MB total)`,
  )

  // All normalized mods in one file. Client filters per-item via
  // @arsenyx/shared's getModsForItem so we don't duplicate mod objects.
  const modsBody = JSON.stringify(slimModsForClient(mods))
  await writeFile(MODS_OUT, modsBody, "utf8")
  const modsMb = (Buffer.byteLength(modsBody, "utf8") / 1024 / 1024).toFixed(2)
  console.log(
    `✓ wrote ${mods.length} normalized mods → mods-all.json (${modsMb} MB)`,
  )

  const arcanesBody = JSON.stringify(slimArcanesForClient(arcanes))
  await writeFile(ARCANES_OUT, arcanesBody, "utf8")
  const arcanesKb = (Buffer.byteLength(arcanesBody, "utf8") / 1024).toFixed(1)
  console.log(
    `✓ wrote ${arcanes.length} normalized arcanes → arcanes-all.json (${arcanesKb} KB)`,
  )

  const helminth = buildHelminthAbilities(allItems)
  const helminthBody = JSON.stringify(helminth)
  await writeFile(HELMINTH_OUT, helminthBody, "utf8")
  const helminthKb = (Buffer.byteLength(helminthBody, "utf8") / 1024).toFixed(1)
  console.log(
    `✓ wrote ${helminth.length} helminth abilities → helminth-abilities.json (${helminthKb} KB)`,
  )

  // Cross-check: the small lookup module must enumerate every weapon present
  // in the full evolution data, otherwise the auto-toggle and image swap will
  // silently miss weapons. Fail loud at build time.
  const evolutionKeys = Object.keys(INCARNON_EVOLUTIONS)
  for (const key of evolutionKeys) {
    if (!INCARNON_NAMES.has(key)) {
      throw new Error(`INCARNON_NAMES missing entry: "${key}"`)
    }
    const expectedImage = INCARNON_EVOLUTIONS[key]?.genesisImage
    if (expectedImage && INCARNON_GENESIS_IMAGES[key] !== expectedImage) {
      throw new Error(
        `INCARNON_GENESIS_IMAGES[${key}] mismatch: ` +
          `expected ${expectedImage}, got ${INCARNON_GENESIS_IMAGES[key]}`,
      )
    }
  }
  for (const key of INCARNON_NAMES) {
    if (!evolutionKeys.includes(key)) {
      throw new Error(`INCARNON_NAMES has stale entry: "${key}"`)
    }
  }
  const incarnonBody = JSON.stringify(INCARNON_EVOLUTIONS)
  await writeFile(INCARNON_OUT, incarnonBody, "utf8")
  const incarnonKb = (
    Buffer.byteLength(incarnonBody, "utf8") / 1024
  ).toFixed(1)
  console.log(
    `✓ wrote ${evolutionKeys.length} incarnon evolutions → incarnon-evolutions.json (${incarnonKb} KB)`,
  )

  const meta = {
    generatedAt: new Date().toISOString(),
    wfcdPackageVersion: wfcd.packageVersion,
    gameUpdate: wfcd.gameUpdate,
    itemCount: totalItems,
    modCount: mods.length,
    arcaneCount: arcanes.length,
  }
  await writeFile(META_OUT, JSON.stringify(meta, null, 2), "utf8")
  console.log(
    `✓ wrote meta.json (game update ${wfcd.gameUpdate ?? "unknown"}, wfcd ${wfcd.packageVersion})`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
