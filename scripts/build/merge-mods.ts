/**
 * Merge DE ExportUpgrades into our normalized Mod shape.
 *
 * Inputs (sibling arrays in ExportUpgrades_en.json):
 *   ExportUpgrades  (1595 mod records)
 *   ExportModSet    (19 set-bonus records — looked up by uniqueName)
 *   ExportAvionics  (82 Railjack/Plexus avionics)
 *   ExportFocusUpgrades (105 focus upgrades)
 *
 * Outputs:
 *   MergedMod[] — what mods-all.json emits.
 *
 * Filters and normalizes DE upgrade records into the Mod shape, with two
 * points worth calling out:
 *
 *   1. **compatName is normalized at build time** (canonical trim, kept in
 *      its source case to match the weapon's modPools list), so the runtime
 *      predicate is a plain array membership check.
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

import { type DeUpgrade, mapRarity, normalizeDescription } from "./read-de"
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

/** DE path fragments that mark a compatName="Claws" mod as beast/companion
 *  (not a player melee Claws mod). Player claw stances live under
 *  /MeleeTrees/ and /PvPMods/ and must NOT match. */
const BEAST_CLAW_PATHS = ["/Sentinel/Kubrow/", "/BeastWeapons/", "/Sets/Hunter/"] as const

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
  /** Exilus-eligible. DE doesn't ship a flag; sourced from wiki
   *  `Mods_data.IsExilus`, keyed by `uniqueName` (= wiki InternalName). */
  isExilus: boolean
  /** PvP-only mod. Detected from the description ("… in Conclave").
   *  The web mod picker filters these out by default — see the Game
   *  Mode toggle in `mod-search-grid.tsx`. */
  isConclave: boolean
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
  /** OpenWF `compatibilityTags` — item must have ≥1 (e.g. `["SEMI_AUTO"]`).
   *  Refined against the weapon's tags in `getModsForItem`. */
  compatTags?: string[]
  /** OpenWF `incompatibilityTags` — item must have none (e.g. `["GRNBOW"]`
   *  on Split Flights, excluding the Grineer-bow Kuva Bramma). */
  incompatTags?: string[]
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

/**
 * Drop entries the planner doesn't surface — the build-time gate that decides
 * which DE upgrades enter the catalog at all (operates directly on DE data).
 */
function shouldKeep(
  mod: DeUpgrade,
  counts: FilterCounts,
  wikiIgnore: Set<string>,
  wikiKnownNames: Set<string>,
): boolean {
  counts.total++
  // Wiki maintainers flagged this as unreleased / non-functional
  // (e.g. "Primed Streamline"). Honor it before anything else.
  if (mod.uniqueName && wikiIgnore.has(mod.uniqueName)) {
    counts.hardcoded++
    return false
  }
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
  // Conclave (PvP) mods are kept and tagged with `isConclave` at emission
  // time (sourced from the wiki's `Conclave = true` flag — see
  // build-items-index.ts). The Game Mode toggle in the picker hides them
  // by default. We still count description-based hits for the build-time
  // diagnostic, but the count is informational only; emission decides PvP
  // membership.
  if (normalizeDescription(mod.description)?.includes("Conclave")) {
    counts.conclave++
  }
  // "Unfused Artifact" entries (Railjack crew-ship innate-damage
  // placeholders) have no stats and aren't buildable in-game.
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
  // DE leaks unreleased Primed Expert mods (Primed Fast Deflection,
  // Primed Streamline, Primed Charged Chamber, Primed Blunderbuss, …).
  // Released ones (Primed Continuity, Primed Reach, Primed Fury, …) all
  // have a wiki entry with a matching Name field. The wiki is the
  // authoritative game-content index, so anything Expert-suffixed that
  // isn't named in the wiki is unreleased — drop it.
  if (uniqueName.endsWith("Expert") && !wikiKnownNames.has(mod.name)) {
    counts.hardcoded++
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

/** Per-mod fields the two emit loops compute differently: the main loop
 *  derives them from the DE record, the avionics loop hardcodes the Plexus
 *  overrides. Everything else (uniqueName, name, description, polarity,
 *  drain, levelStats, OpenWF compat fields) is read straight off `raw` and
 *  `plus`, so it lives in `toMergedMod`. */
interface MergedModParts {
  polarity: string
  rarity: string
  compatName: string
  type: string
  isAugment: boolean
  isPrime: boolean
  isExilus: boolean
  isConclave: boolean
  /** Set-bonus reference + stats. Avionics carry neither, so both default
   *  to absent. */
  modSet?: string
  modSetStats?: string[]
}

/** Assemble a `MergedMod` from a DE record, its OpenWF augmentation fields,
 *  and the per-caller `parts`. Shared by the main upgrade loop and the
 *  avionics loop so the emitted field set can't drift between them. */
function toMergedMod(
  raw: DeUpgrade,
  plus: PePlusUpgradeFields | undefined,
  parts: MergedModParts,
): MergedMod {
  return {
    uniqueName: raw.uniqueName,
    name: raw.name,
    description: normalizeDescription(raw.description),
    polarity: parts.polarity,
    rarity: parts.rarity,
    baseDrain: raw.baseDrain ?? 0,
    fusionLimit: raw.fusionLimit ?? 0,
    compatName: parts.compatName,
    type: parts.type,
    isAugment: parts.isAugment,
    isPrime: parts.isPrime,
    isExilus: parts.isExilus,
    isConclave: parts.isConclave,
    levelStats: raw.levelStats,
    modSet: parts.modSet,
    modSetStats: parts.modSetStats,
    compat: plus?.compat,
    compatTags: plus?.compatibilityTags,
    incompatTags: plus?.incompatibilityTags,
  }
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
   *  supplied, each merged mod gets `compat` from this lookup. */
  pePlus: Map<string, PePlusUpgradeFields> = new Map(),
  /** Wiki-sourced `IsExilus` flag keyed by mod `uniqueName`. Mods missing
   *  from this map default to `false`. */
  wikiExilus: Map<string, boolean> = new Map(),
  /** DE `ExportAvionics` — railjack Plexus mods. Ship empty `compatName`
   *  and empty `type` in DE, so we tag them with `type: "Plexus Mod"`
   *  here to match the runtime predicate in
   *  packages/shared/src/warframe/mods.ts (`isPlexusMod`). */
  rawAvionics: DeUpgrade[] = [],
  /** Wiki mods flagged `_IgnoreEntry = true` (keyed by InternalName). */
  wikiIgnore: Set<string> = new Set(),
  /** All wiki mod display Names. Gates the Primed-Expert allowance against
   *  DE's stream of unreleased Primed mods (Primed Fast Deflection,
   *  Primed Charged Chamber, Primed Blunderbuss, Primed Streamline have
   *  no wiki entry → dropped; Primed Continuity / Reach / Fury / Steady
   *  Hands / Redirection do → kept). Keyed by Name rather than
   *  InternalName because the wiki inconsistently includes the `/Expert/`
   *  infix in InternalName. */
  wikiKnownNames: Set<string> = new Set(),
  /** Wiki mods with `Conclave = true` (keyed by InternalName). The
   *  canonical PvP marker — the description "in Conclave" substring only
   *  catches ~14% of Conclave mods. */
  wikiConclave: Set<string> = new Set(),
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
    if (!shouldKeep(raw, counts, wikiIgnore, wikiKnownNames)) continue

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
    else rarity = mapRarity(raw.rarity, { context: `mod ${raw.name}` })

    // Trim compatName — DE has " Itzal" (leading space), trailing whitespace
    // can leak in, etc. Preserve case so it matches weapon.modPools entries.
    let compatName = (raw.compatName ?? "").trim()
    // Beast-claw mods (Maul, Bite, Frost Jaw, Sepsis Claws, Beast Postures,
    // Hunter Synergy, …) ship with compatName "Claws" — the same string
    // player melee Claws mods use — so without disambiguation they leak
    // onto weapon Claws (Venka, Ripkas, Garuda Talons). They live under
    // several DE paths (/Sentinel/Kubrow/, /BeastWeapons/, the Hunter set);
    // remap any "Claws" mod under those to a distinct pool name so player
    // Claws and beast claws stop colliding. Player claw stances live under
    // /MeleeTrees/ and /PvPMods/ and are left untouched. Paired with
    // "BeastClaws" in class-pools.ts and KNOWN_MOD_POOLS in merge-weapons.ts.
    if (compatName === "Claws" && BEAST_CLAW_PATHS.some((p) => raw.uniqueName?.includes(p))) {
      compatName = "BeastClaws"
    }

    const isPrime =
      raw.name.includes("Primed ") || raw.name.includes("Umbral ")
    // Augments are detected by an "Augment"-rooted suffix on the DE
    // `uniqueName` path (e.g. .../FooAugmentCard, .../BarAugmentMod): the
    // regex matches "Augment" followed by zero or more word chars at end of
    // string, so any Augment* variant qualifies.
    const isAugment = /Augment\w*$/.test(raw.uniqueName ?? "")

    const modSetRef = (raw as { modSet?: string }).modSet
    const modSetStats = modSetRef ? setStats.get(modSetRef) : undefined

    const plus = pePlus.get(raw.uniqueName)

    mods.push(
      toMergedMod(raw, plus, {
        polarity,
        rarity,
        compatName,
        type,
        isAugment,
        isPrime,
        isExilus: wikiExilus.get(raw.uniqueName) ?? false,
        isConclave: wikiConclave.has(raw.uniqueName),
        modSet: modSetRef,
        modSetStats,
      }),
    )
  }

  // Avionics (Railjack Plexus mods). DE ships them with empty `type` and
  // empty `compatName`, so the regular `shouldKeep` / type-validation paths
  // above would drop them. Process separately and tag with the canonical
  // "Plexus Mod" type the runtime expects.
  for (const raw of rawAvionics) {
    if (!raw.name || !raw.uniqueName) continue
    // Drop the pre-fusion "Unfused Artifact" placeholders. DE ships one
    // per `/Railjack/<section>/Base*` shell; the real avionics live under
    // `Lavan*` / `Vidar* `/ `Zekti*` house variants and have proper names.
    if (raw.name === "Unfused Artifact") continue
    const polarityRaw = raw.polarity ?? ""
    const polarity = DE_POLARITY_MAP[polarityRaw] ?? null
    if (!polarity) {
      throw new Error(
        `Unknown DE polarity "${polarityRaw}" on avionic ${raw.name}. ` +
          `Add to DE_POLARITY_MAP in merge-mods.ts.`,
      )
    }
    const rarity = mapRarity(raw.rarity, { context: `avionic ${raw.name}` })
    const plus = pePlus.get(raw.uniqueName)
    mods.push(
      toMergedMod(raw, plus, {
        polarity,
        rarity,
        // The Plexus item's `modPools` is `["Plexus"]` (see
        // data/curated/plexus.ts), and `getModsForItem` filters by
        // `mod.compatName ∈ modPools`. Tag avionics so the structural
        // router lets them through; sub-slot routing (Battle/Tactical/
        // Integrated) still happens via uniqueName path and `type`.
        compatName: "Plexus",
        type: "Plexus Mod",
        isAugment: false,
        isPrime: false,
        isExilus: false,
        isConclave: false,
      }),
    )
    counts.total++
    counts.kept++
  }

  return { mods, setStats, counts }
}

