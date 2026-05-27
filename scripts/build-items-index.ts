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

import { BEAST_CLAWS } from "./beast-claws"

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
  patchAtmosphericArchgunVariants(all)
  patchMissingAuras(all)
  patchVariantWeaponTypes(all)
  // Beast claws (Adarza/Smeeta/Vasca/Kubrows/Vulpaphylas/Predasites) aren't
  // in DE's PublicExport, so we inject hardcoded entries. See beast-claws.ts.
  all.push(...BEAST_CLAWS)
  return all
}

// WFCD omits the `aura` field entirely for a handful of warframes, which
// hides the aura slot in the editor. The value `"aura"` represents the
// universal/no-innate-polarity slot (matches Protea/Dante); specific
// polarities are filled in for frames whose innate aura polarity is known.
const MISSING_AURAS: Record<string, string> = {
  Excalibur: "naramon",
  Nekros: "aura",
  "Nekros Prime": "aura",
  Sevagoth: "aura",
  "Sevagoth Prime": "aura",
}

function patchMissingAuras(items: BrowseableItem[]): void {
  for (const item of items as Array<BrowseableItem & { aura?: string }>) {
    if (item.aura) continue
    const aura = MISSING_AURAS[item.name]
    if (aura) item.aura = aura
  }
}

// WFCD occasionally ships a Coda/Kuva/Tenet variant with a different `type`
// from its base weapon (e.g., Coda Bubonico → "Rifle" while Bubonico is
// "Shotgun"). The type drives mod-pool routing and the displayed weapon
// class, so divergence shows up as wrong mods on the build page. Inherit the
// base weapon's type whenever the variant's prefix matches.
const VARIANT_PREFIXES = ["Coda ", "Kuva ", "Tenet "] as const

function patchVariantWeaponTypes(items: BrowseableItem[]): void {
  const typed = items as Array<BrowseableItem & { type?: string }>
  const byName = new Map<string, BrowseableItem & { type?: string }>()
  for (const item of typed) byName.set(item.name, item)

  for (const item of typed) {
    const prefix = VARIANT_PREFIXES.find((p) => item.name.startsWith(p))
    if (!prefix) continue
    const baseName = item.name.slice(prefix.length)
    const base = byName.get(baseName)
    if (!base?.type) continue
    if (item.type === base.type) continue
    item.type = base.type
  }
}

// Atmospheric Archguns (deployed on the ground via Archgun Deployer) lose
// their innate elemental damage. WFCD only models the Archwing-mission
// profile, so we curate divergent variants here.
const ATMOSPHERIC_OVERRIDES: Record<string, { strip: ReadonlyArray<string> }> =
  {
    Corvas: { strip: ["heat"] },
    "Corvas Prime": { strip: ["heat"] },
  }

type WeaponLike = {
  name: string
  damage?: Record<string, number | undefined>
  totalDamage?: number
  attacks?: Array<{ damage?: Record<string, number | undefined> | string }>
  atmosphericDamage?: Record<string, number | undefined>
  atmosphericTotalDamage?: number
  atmosphericAttacks?: Array<{
    damage?: Record<string, number | undefined> | string
  }>
}

function patchAtmosphericArchgunVariants(items: BrowseableItem[]): void {
  for (const item of items as WeaponLike[]) {
    const override = ATMOSPHERIC_OVERRIDES[item.name]
    if (!override) continue
    if (!item.damage) continue

    const damage = { ...item.damage }
    let removed = 0
    for (const key of override.strip) {
      removed += damage[key] ?? 0
      damage[key] = 0
    }
    // `damage.total` is a precomputed sum, not a damage type — keep it
    // consistent with the per-type fields we just zeroed.
    if (typeof damage.total === "number") {
      damage.total = damage.total - removed
    }
    item.atmosphericDamage = damage
    item.atmosphericTotalDamage =
      item.totalDamage !== undefined
        ? item.totalDamage - removed
        : Object.values(damage).reduce<number>(
            (s, v) => s + (typeof v === "number" ? v : 0),
            0,
          )

    if (Array.isArray(item.attacks)) {
      item.atmosphericAttacks = item.attacks.map((attack) => {
        if (typeof attack.damage !== "object" || !attack.damage) return attack
        const next = { ...attack.damage }
        for (const key of override.strip) next[key] = 0
        return { ...attack, damage: next }
      })
    }
  }
}

async function loadAllMods(): Promise<Mod[]> {
  const body = await readFile(resolve(WFCD_JSON, "Mods.json"), "utf8")
  return JSON.parse(body) as Mod[]
}

async function loadAllArcanes(): Promise<Arcane[]> {
  const body = await readFile(resolve(WFCD_JSON, "Arcanes.json"), "utf8")
  return JSON.parse(body) as Arcane[]
}

// Synthetic Plexus item — DE doesn't export it as a standalone entry, so we
// inject one. The detail file is written in `main` alongside the per-item
// detail files. Keep the BrowseItem and BrowseableItem shapes in sync.
const PLEXUS_UNIQUE_NAME = "/Lotus/Railjacks/Plexus"
const PLEXUS_SLUG = "plexus"
const PLEXUS_BROWSE_ITEM: BrowseItem = {
  uniqueName: PLEXUS_UNIQUE_NAME,
  name: "Plexus",
  slug: PLEXUS_SLUG,
  category: "railjack",
  // Reuse the Caballero Railjack Skin asset (Skins.json) — closest available
  // ship-themed image on the warframestat CDN for the Plexus entry.
  imageName: "RailjackWrasseSkin.png",
  isPrime: false,
  type: "Plexus",
}
const PLEXUS_DETAIL = {
  uniqueName: PLEXUS_UNIQUE_NAME,
  name: "Plexus",
  slug: PLEXUS_SLUG,
  category: "railjack",
  type: "Plexus",
  imageName: "RailjackWrasseSkin.png",
  description:
    "Personal modular Railjack loadout. Houses Battle, Tactical, and Integrated mods that travel with you between ships.",
  tradable: false,
  // 1 Aura + 14 normal slots (3 Battle, 3 Tactical, 8 Integrated) are
  // resolved by the build editor's layout helpers, not stored here.
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
  byCategory.railjack = [PLEXUS_BROWSE_ITEM, ...(byCategory.railjack ?? [])]

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
  // Synthetic Plexus detail file. Bypasses slimItemForClient because the
  // entry isn't a WFCD BrowseableItem — its shape is hand-curated above.
  {
    const body = JSON.stringify(PLEXUS_DETAIL)
    await writeFile(
      resolve(DETAIL_DIR, "railjack", `${PLEXUS_SLUG}.json`),
      body,
      "utf8",
    )
    detailCount++
    detailBytes += Buffer.byteLength(body, "utf8")
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
  const incarnonKb = (Buffer.byteLength(incarnonBody, "utf8") / 1024).toFixed(1)
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
