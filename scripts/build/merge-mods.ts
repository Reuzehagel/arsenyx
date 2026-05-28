/**
 * Merge DE ExportUpgrades into our normalized Mod shape.
 *
 * Inputs:
 *   DE ExportUpgrades (1595 records, including mods, mod sets, avionics,
 *                      focus upgrades — split into sub-tables)
 *   DE ExportModSet (19 set-bonus records — looked up by uniqueName)
 *
 * Outputs:
 *   MergedMod[] — what mods-all.json emits.
 *
 * The legacy `normalizeMods()` in shared/warframe/mods.ts handled most of
 * this on WFCD-shaped data. This module reproduces its filter/normalize
 * behavior against DE data directly, with two refinements:
 *
 *   1. **compatName is normalized at build time** (canonical trim, kept in
 *      its source case to match the weapon's modPools list). This is the
 *      "normalize at build, not at runtime" piece from the plan — the
 *      runtime predicate becomes a plain array membership check.
 *
 *   2. **polarity moves from DE's AP_* enum to our lowercase scheme** at
 *      build time (matches what shared/warframe/types.ts expects). No
 *      runtime mapping needed.
 *
 * Fail-loud assertions:
 *   - Unknown polarity enum value
 *   - Unknown rarity enum value
 *   - Unknown type enum value
 */

import type { DeUpgrade } from "./read-de"
import type { PePlusUpgradeFields } from "./read-pe-plus"

/** DE's `AP_*` polarity → canonical lowercase name used by the UI. */
const DE_POLARITY_MAP: Record<string, string> = {
  AP_ATTACK: "madurai",
  AP_DEFENSE: "vazarin",
  AP_TACTIC: "naramon",
  AP_POWER: "zenurik",
  AP_WARD: "unairu",
  AP_PRECEPT: "penjaga",
  AP_UMBRA: "umbra",
  AP_ANY: "any",
  AP_UNIVERSAL: "universal",
}

/** DE rarity (UPPERCASE) → capitalized canonical. Plus the two
 *  name-derived variants (Amalgam, Galvanized) added during normalize. */
const DE_RARITY_MAP: Record<string, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  LEGENDARY: "Legendary",
}

/** Closed set of DE mod types — assert on drift. */
const KNOWN_MOD_TYPES = new Set<string>([
  "---",
  "ARCH-GUN",
  "ARCH-MELEE",
  "ARCHWING",
  "AURA",
  "HELMINTH CHARGER",
  "KAVAT",
  "KUBROW",
  "MELEE",
  "PARAZON",
  "PRIMARY",
  "SECONDARY",
  "SENTINEL",
  "STANCE",
  "WARFRAME",
])

export interface MergedMod {
  uniqueName: string
  name: string
  description?: string
  polarity: string
  rarity: string
  baseDrain: number
  fusionLimit: number
  /** Trimmed, canonical-cased compatName. Matches the weapon's
   *  `modPools[]` entries. Empty string for mods with no compatName
   *  (e.g. universal / aura / general slot mods). */
  compatName: string
  /** DE type (canonical-cased, e.g. "Primary", "Stance"). */
  type: string
  /** True for "Excalibur"-style augment mods that key off a frame name. */
  isAugment: boolean
  /** True for Primed/Umbral mods. */
  isPrime: boolean
  /** Exilus-eligible. DE doesn't ship a flag; derived from polarity + slot
   *  heuristics in the legacy code. Stubbed to false here — Phase 4b will
   *  reconcile with wiki Mods/data which carries this explicitly. */
  isExilus: boolean
  levelStats?: Array<{ stats: string[] }>
  modSet?: string
  modSetStats?: string[]
  /** Wiki Image filename, filled by build-items-index from the central
   *  wiki-image lookup. Bare filename; consumer resolves via wiki. */
  imageName?: string
  /** OpenWF `compat` — either a specific item `uniqueName` (augments)
   *  or a generic class-anchor path (e.g. `.../PlayerMeleeWeapon`) for
   *  non-augment mods. `build-items-index.ts` transforms this into
   *  `compatItems` (a closed list of catalog item uniqueNames) and
   *  drops this raw field before write. Not present on the emitted
   *  mods-all.json — only here in the build-time merged shape. */
  compat?: string
  /** Resolved augment target: catalog item uniqueNames this mod fits.
   *  Set by `build-items-index.ts`; absent on non-augment mods.
   *  Runtime check: `compatItems.includes(item.uniqueName)`. */
  compatItems?: string[]
  /** OpenWF structural compatibility tags (e.g. `["WHIPS_STANCE"]`). */
  compatibilityTags?: string[]
  /** OpenWF structural incompatibility tags. Used to forbid otherwise-
   *  matching mods on specific items. */
  incompatibilityTags?: string[]
}

interface FilterCounts {
  total: number
  kept: number
  conclave: number
  riven: number
  beginner: number
  nemesis: number
  noNameOrCompat: number
  hardcoded: number
}

/** DE ships `description` as `string[]` (one entry per paragraph). The
 *  frontend expects a single string; join with newlines. */
function normalizeDescription(
  d: string | string[] | undefined,
): string | undefined {
  if (d === undefined) return undefined
  return Array.isArray(d) ? d.join("\n") : d
}

/**
 * Drop entries the planner doesn't surface. Mirrors `normalizeMods()` in
 * shared/warframe/mods.ts but works directly against DE data.
 */
function shouldKeep(mod: DeUpgrade, counts: FilterCounts): boolean {
  counts.total++
  if (!mod.name) {
    counts.noNameOrCompat++
    return false
  }
  if (mod.name.includes("Riven Mod")) {
    counts.riven++
    return false
  }
  if (!mod.compatName && !mod.type) {
    counts.noNameOrCompat++
    return false
  }
  if (normalizeDescription(mod.description)?.includes("Conclave")) {
    counts.conclave++
    return false
  }
  // Plexus "Unfused Artifact" entries are pre-fusion placeholders with no
  // stats; they're not buildable in-game.
  if (mod.name === "Unfused Artifact") {
    counts.hardcoded++
    return false
  }
  const uniqueName = mod.uniqueName ?? ""
  if (uniqueName.includes("/Beginner/")) {
    counts.beginner++
    return false
  }
  if (uniqueName.endsWith("Intermediate")) {
    counts.beginner++
    return false
  }
  if (uniqueName.endsWith("Expert") && !mod.name.includes("Primed")) {
    counts.beginner++
    return false
  }
  if (uniqueName.includes("/Nemesis/")) {
    counts.nemesis++
    return false
  }
  if (uniqueName.endsWith("SubMod")) {
    counts.hardcoded++
    return false
  }
  // Unused upstream entry — a stray duplicate "Pressure Point" with combo
  // count bonus. Not a real in-game mod.
  if (
    uniqueName === "/Lotus/Upgrades/Mods/Melee/WeaponMeleeDamageOnHeavyKillMod"
  ) {
    counts.hardcoded++
    return false
  }
  counts.kept++
  return true
}

export interface MergeModsResult {
  mods: MergedMod[]
  /** Map by uniqueName → modset stats, so weapons can show set bonuses. */
  setStats: Map<string, string[]>
  counts: FilterCounts
}

export function mergeMods(
  rawUpgrades: DeUpgrade[],
  rawModSets: DeUpgrade[] = [],
  /** Optional OpenWF augmentation map keyed by mod `uniqueName`. When
   *  supplied, each merged mod gets `compat` / `compatibilityTags` /
   *  `incompatibilityTags` from this lookup. */
  pePlus: Map<string, PePlusUpgradeFields> = new Map(),
): MergeModsResult {
  // Build the mod-set index first so we can attach set stats per mod.
  const setStats = new Map<string, string[]>()
  for (const set of rawModSets) {
    if (set.uniqueName) {
      // ExportModSet entries carry an array of stat strings via `stats` (a
      // top-level field on the set record, not a levelStats nest).
      const stats = (set as { stats?: string[] }).stats
      if (Array.isArray(stats)) setStats.set(set.uniqueName, stats)
    }
  }

  const counts: FilterCounts = {
    total: 0,
    kept: 0,
    conclave: 0,
    riven: 0,
    beginner: 0,
    nemesis: 0,
    noNameOrCompat: 0,
    hardcoded: 0,
  }

  const mods: MergedMod[] = []
  for (const raw of rawUpgrades) {
    if (!shouldKeep(raw, counts)) continue

    const polarityRaw = raw.polarity ?? ""
    const polarity = DE_POLARITY_MAP[polarityRaw] ?? null
    if (!polarity) {
      throw new Error(
        `Unknown DE polarity "${polarityRaw}" on mod ${raw.name}. ` +
          `Add to DE_POLARITY_MAP in merge-mods.ts.`,
      )
    }

    const typeRaw = raw.type ?? ""
    if (typeRaw && !KNOWN_MOD_TYPES.has(typeRaw)) {
      throw new Error(
        `Unknown DE mod type "${typeRaw}" on ${raw.name}. ` +
          `Add to KNOWN_MOD_TYPES.`,
      )
    }
    // Canonical-case "PRIMARY" → "Primary"
    const type =
      typeRaw === "---"
        ? ""
        : typeRaw
            .split(" ")
            .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
            .join(" ")

    // Rarity — derive Amalgam/Galvanized from the name (matching legacy
    // behavior); otherwise map DE rarity.
    let rarity: string
    if (raw.name.startsWith("Amalgam ")) rarity = "Amalgam"
    else if (raw.name.startsWith("Galvanized ")) rarity = "Galvanized"
    else {
      const rarityRaw = raw.rarity ?? ""
      const mapped = DE_RARITY_MAP[rarityRaw]
      if (!mapped) {
        throw new Error(
          `Unknown DE rarity "${rarityRaw}" on mod ${raw.name}. ` +
            `Add to DE_RARITY_MAP.`,
        )
      }
      rarity = mapped
    }

    // Trim compatName — DE has " Itzal" (leading space), trailing whitespace
    // can leak in, etc. Preserve case so it matches weapon.modPools entries.
    const compatName = (raw.compatName ?? "").trim()

    const isPrime =
      raw.name.includes("Primed ") || raw.name.includes("Umbral ")
    const isAugment =
      // Augments key off the frame's name as compatName. Simple heuristic:
      // any mod whose compatName is a single frame name (i.e., not a coarse
      // pool like "Rifle"/"Melee"). The merge-warframes step will provide
      // an authoritative frame-name set so we can promote this from
      // heuristic to lookup; for now, leave false and let downstream code
      // detect augments structurally (looks at uniqueName /Augment/).
      raw.uniqueName?.includes("/Augment/") ?? false

    const modSetRef = (raw as { modSet?: string }).modSet
    const modSetStats = modSetRef ? setStats.get(modSetRef) : undefined

    const plus = pePlus.get(raw.uniqueName)

    mods.push({
      uniqueName: raw.uniqueName,
      name: raw.name,
      description: normalizeDescription(raw.description),
      polarity,
      rarity,
      baseDrain: raw.baseDrain ?? 0,
      fusionLimit: raw.fusionLimit ?? 0,
      compatName,
      type,
      isAugment,
      isPrime,
      isExilus: false,
      levelStats: raw.levelStats,
      modSet: modSetRef,
      modSetStats,
      compat: plus?.compat,
      compatibilityTags: plus?.compatibilityTags,
      incompatibilityTags: plus?.incompatibilityTags,
    })
  }

  return { mods, setStats, counts }
}

/**
 * The collapsed runtime predicate (Phase 6 lands this as the body of
 * `weaponAcceptsMod` in shared/warframe/mods.ts). Kept here as the spec —
 * once Phase 6 ships, this function moves and this file no longer exports
 * it.
 */
export function weaponAcceptsMod(
  weapon: { modPools: readonly string[] },
  mod: { compatName: string },
): boolean {
  // Build-normalized compatName matches weapon.modPools entries verbatim
  // (case-sensitive, trimmed). The old runtime guessing collapses to one
  // structural membership check.
  return weapon.modPools.includes(mod.compatName)
}
