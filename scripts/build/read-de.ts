/**
 * Read DE PublicExport JSON mirrors from `data/raw/de/` into typed shapes.
 *
 * One read per blob — no network, no LZMA. Each `Export*.json` file is
 * already pretty-printed JSON; we just parse it.
 *
 * Each file's top-level shape is `{ Export<Name>: [...] }` (an array of
 * records) for most blobs. ExportManifest is the exception — it's a single
 * record-shaped object keyed by `Manifest`.
 *
 * We expose narrow accessors per category rather than a single union to
 * keep callers' types readable. Unknown fields are preserved (typed
 * `Record<string, unknown>`) so the merge step can pluck what it needs.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { Mod } from "@arsenyx/shared/warframe/types"

import type {
  DeFrame,
  DeHelminthAbility,
  DeManifestEntry,
  DeSentinel,
  DeUpgrade,
  DeUpgradesBlob,
  DeWeapon,
} from "./de-types"
import { RAW_DE_DIR as DE_DIR } from "./paths"

function readFile<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(DE_DIR, name), "utf8")) as T
}

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

/** DE productCategory enum (frozen — assert on drift). */
export const KNOWN_PRODUCT_CATEGORIES = new Set([
  "Pistols",
  "Melee",
  "LongGuns",
  "SpecialItems",
  "SentinelWeapons",
  "SpaceGuns",
  "SpaceMelee",
  "OperatorAmps",
])

export function readDeWeapons(): DeWeapon[] {
  const raw = readFile<{ ExportWeapons: DeWeapon[] }>("ExportWeapons_en.json")
  return raw.ExportWeapons ?? []
}

// ---------------------------------------------------------------------------
// Mods (the umbrella "upgrades" blob — includes mods + mod sets + avionics +
// focus upgrades).
// ---------------------------------------------------------------------------

export function readDeUpgrades(): DeUpgradesBlob {
  return readFile<DeUpgradesBlob>("ExportUpgrades_en.json")
}

/** DE ships `description` as `string[]` (one entry per paragraph); arcanes
 *  ride the same Upgrade type so the field is unioned to `string | string[]`.
 *  The frontend expects a single string — join with newlines. */
export function normalizeDescription(
  d: string | string[] | undefined,
): string | undefined {
  if (d === undefined) return undefined
  return Array.isArray(d) ? d.join("\n") : d
}

/** DE rarity (UPPERCASE) → capitalized canonical. Shared by mods and
 *  arcanes. (Mods additionally derive the name-based Amalgam/Galvanized
 *  variants before consulting this table — see merge-mods.ts.) */
type DeRarity = Extract<
  Mod["rarity"],
  "Common" | "Uncommon" | "Rare" | "Legendary"
>
const DE_RARITY_MAP: Partial<Record<string, DeRarity>> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  LEGENDARY: "Legendary",
}

/** Map a DE rarity enum to its canonical capitalized form. Callers differ
 *  on unknown values: mods fail loud (`onUnknown: "throw"`, the default) so
 *  a new DE tier surfaces at build time; arcanes pass the raw value through
 *  (`onUnknown: "passthrough"`) to stay tolerant of the looser arcane blob. */
export function mapRarity(
  raw: string | undefined,
  opts?: {
    onUnknown?: "throw"
    /** Used only in the thrown error message. */
    context?: string
  },
): DeRarity
export function mapRarity(
  raw: string | undefined,
  opts: { onUnknown: "passthrough" },
): string
export function mapRarity(
  raw: string | undefined,
  opts: { onUnknown?: "throw" | "passthrough"; context?: string } = {},
): string {
  const { onUnknown = "throw", context } = opts
  const rarityRaw = raw ?? ""
  const mapped = DE_RARITY_MAP[rarityRaw]
  if (mapped) return mapped
  if (onUnknown === "passthrough") return rarityRaw
  throw new Error(
    `Unknown DE rarity "${rarityRaw}"${context ? ` on ${context}` : ""}. ` +
      `Add to DE_RARITY_MAP in read-de.ts.`,
  )
}

// ---------------------------------------------------------------------------
// Warframes / Sentinels / Resources / Misc — typed loosely.
// ---------------------------------------------------------------------------

export function readDeFrames(): {
  ExportWarframes: DeFrame[]
  ExportAbilities: DeHelminthAbility[]
} {
  return readFile("ExportWarframes_en.json")
}

export function readDeSentinels(): { ExportSentinels: DeSentinel[] } {
  return readFile("ExportSentinels_en.json")
}

export function readDeManifest(): DeManifestEntry[] {
  const raw = readFile<{ Manifest: DeManifestEntry[] }>("ExportManifest.json")
  return raw.Manifest ?? []
}

export function readDeArcanes(): { ExportRelicArcane: DeUpgrade[] } {
  // Arcanes ship in ExportRelicArcane_en.json under the misleading filename
  // — the array carries both void relics and arcanes. Filter by uniqueName
  // path prefix (/CosmeticEnhancers/) in merge-arcanes.ts.
  return readFile("ExportRelicArcane_en.json")
}
