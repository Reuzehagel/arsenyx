/**
 * Precompute static browse data.
 *
 *  1. `items-index.json` — every browseable item as a card payload.
 *  2. `items/<category>/<slug>.json` — one file per item, full WFCD object,
 *     consumed by the detail page.
 *
 * Reads raw WFCD JSON directly from the `@wfcd/items` package, so no
 * `legacy/` imports are required.
 *
 * Run: `bun run build:items`
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"

import { buildIndex } from "@arsenyx/shared/warframe/categorize"
import { BROWSE_CATEGORIES } from "@arsenyx/shared/warframe/categories"
import { normalizeMods } from "@arsenyx/shared/warframe/mods"
import type {
  BrowseableItem,
  BrowseCategory,
  BrowseItem,
  Mod,
} from "@arsenyx/shared/warframe/types"

const require = createRequire(import.meta.url)
const WFCD_PKG = dirname(require.resolve("@wfcd/items/package.json"))
const WFCD_JSON = resolve(WFCD_PKG, "data/json")

// WFCD files that contribute browseable items. See legacy/scripts/sync-warframe-data.ts.
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
const HELMINTH_OUT = resolve(PUBLIC_DATA, "helminth-abilities.json")

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

async function buildHelminthAbilities(): Promise<HelminthAbility[]> {
  const body = await readFile(resolve(WFCD_JSON, "Warframes.json"), "utf8")
  const warframes = JSON.parse(body) as Array<{
    name: string
    abilities?: Array<{
      uniqueName: string
      name: string
      imageName?: string
      description: string
    }>
  }>
  const byName = new Map(warframes.map((w) => [w.name, w]))
  const out: HelminthAbility[] = []

  const helminth = byName.get("Helminth")
  if (helminth?.abilities) {
    for (const a of helminth.abilities) {
      out.push({ ...a, source: "Helminth" })
    }
  }

  for (const [frame, abilityName] of Object.entries(SUBSUMABLE_ABILITIES)) {
    const wf = byName.get(frame)
    const a = wf?.abilities?.find((x) => x.name === abilityName)
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

async function main() {
  const [allItems, rawMods] = await Promise.all([
    loadAllItems(),
    loadAllMods(),
  ])
  const mods = normalizeMods(rawMods)
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
      const body = JSON.stringify(full)
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
  const modsBody = JSON.stringify(mods)
  await writeFile(MODS_OUT, modsBody, "utf8")
  const modsMb = (Buffer.byteLength(modsBody, "utf8") / 1024 / 1024).toFixed(2)
  console.log(
    `✓ wrote ${mods.length} normalized mods → mods-all.json (${modsMb} MB)`,
  )

  const helminth = await buildHelminthAbilities()
  const helminthBody = JSON.stringify(helminth)
  await writeFile(HELMINTH_OUT, helminthBody, "utf8")
  const helminthKb = (Buffer.byteLength(helminthBody, "utf8") / 1024).toFixed(1)
  console.log(
    `✓ wrote ${helminth.length} helminth abilities → helminth-abilities.json (${helminthKb} KB)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
