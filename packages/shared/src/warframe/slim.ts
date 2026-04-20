/**
 * Slim helpers — strip bulky WFCD fields before serializing to client components.
 *
 * Full item / mod / arcane objects carry fields like `drops`, `patchlogs`,
 * `components`, `wikiaUrl`, `transmutable`, etc. that are never used by the
 * build editor UI.  Stripping them here avoids sending unnecessary bytes in the
 * RSC payload.
 *
 * Items use runtime exclusion (WFCD injects fields beyond our TS types).
 * Mods and arcanes use typed Pick helpers so the compiler catches shape changes.
 */

import type { Arcane, BrowseableItem, Mod } from "./types"

// ---------------------------------------------------------------------------
// Generic pick helper — avoids `as unknown as` double-casts
// ---------------------------------------------------------------------------

function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

/**
 * WFCD items carry many fields at runtime that aren't in our TS types
 * (drops, patchlogs, components, etc.). We exclude known heavy fields
 * rather than allowlisting, so new TS-typed fields pass through automatically.
 */
const ITEM_EXCLUDE_KEYS = new Set([
  "drops",
  "patchlogs",
  "components",
  "introduced",
  "marketCost",
  "bpCost",
  "wikiaUrl",
  "wikiaThumbnail",
  "buildPrice",
  "buildTime",
  "releaseDate",
  "transmutable",
  "estimatedVaultDate",
  "consumeOnBuild",
  "skipBuildTimePrice",
])

export function slimItemForClient(item: BrowseableItem): BrowseableItem {
  const raw = item as unknown as Record<string, unknown>
  const slim: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (!ITEM_EXCLUDE_KEYS.has(key)) {
      slim[key] = raw[key]
    }
  }
  return slim as unknown as BrowseableItem
}

// ---------------------------------------------------------------------------
// Mods
// ---------------------------------------------------------------------------

const MOD_KEYS = [
  "uniqueName",
  "name",
  "description",
  "imageName",
  "polarity",
  "rarity",
  "baseDrain",
  "fusionLimit",
  "compatName",
  "type",
  "tradable",
  "isAugment",
  "isExilus",
  "isUtility",
  "levelStats",
  "modSet",
  "modSetStats",
  "wikiaThumbnail",
] as const satisfies readonly (keyof Mod)[]

function slimMod(mod: Mod): Pick<Mod, (typeof MOD_KEYS)[number]> {
  return pick(mod, MOD_KEYS)
}

export function slimModsForClient(mods: Mod[]): Mod[] {
  return mods.map(slimMod) as Mod[]
}

/**
 * Slim a helminth-augment map (Record<uniqueName, Mod[]>).
 */
export function slimHelminthAugmentModsForClient(
  map: Record<string, Mod[]> | undefined,
): Record<string, Mod[]> | undefined {
  if (!map) return undefined
  const slim: Record<string, Mod[]> = {}
  for (const [key, mods] of Object.entries(map)) {
    slim[key] = mods.map(slimMod) as Mod[]
  }
  return slim
}

// ---------------------------------------------------------------------------
// Arcanes
// ---------------------------------------------------------------------------

const ARCANE_KEYS = [
  "uniqueName",
  "name",
  "imageName",
  "rarity",
  "type",
  "tradable",
  "levelStats",
] as const satisfies readonly (keyof Arcane)[]

export function slimArcanesForClient(arcanes: Arcane[]): Arcane[] {
  return arcanes.map((arcane) => pick(arcane, ARCANE_KEYS)) as Arcane[]
}
