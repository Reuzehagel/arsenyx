/**
 * Merge DE ExportUpgrades into our normalized Mod shape.
 *
 * Inputs (sibling arrays in ExportUpgrades_en.json):
 *   ExportUpgrades  (mod records)
 *   ExportModSet    (set-bonus records — looked up by uniqueName)
 *   ExportAvionics  (Railjack/Plexus avionics)
 * plus the wiki-sourced flags of wiki-mod-flags.ts.
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

import { BEAST_CLAW_POOL } from "@arsenyx/shared/warframe/mods"
import { PLEXUS_MOD_TYPE, PLEXUS_POOL } from "@arsenyx/shared/warframe/plexus"
import {
  DE_POLARITY_MAP,
  type Polarity,
} from "@arsenyx/shared/warframe/polarities"
import type { Mod } from "@arsenyx/shared/warframe/types"

import { BEAST_CLAW_MOD_PATHS } from "../../data/curated/beast-claws"
import {
  DROPPED_MOD_NAMES,
  DROPPED_MOD_UNIQUE_NAMES,
} from "../../data/curated/mod-drops"
import type { DeUpgrade } from "./de-types"
import { modVariantBase, PRIMED_MOD_PREFIXES } from "./names"
import { mapRarity, normalizeDescription } from "./read-de"
import type { PePlusUpgradeFields } from "./read-pe-plus"
import type { WikiModFlags } from "./wiki-mod-flags"

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
  polarity: Polarity
  rarity: Mod["rarity"]
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
   *  `Mods_data.IsExilus` (see wiki-mod-flags.ts). */
  isExilus: boolean
  /** PvP-only mod: wiki `Conclave = true`, minus the PvE-usable allowlist
   *  (wiki-mod-flags.ts). The web mod picker hides these by default — see
   *  the Game Mode toggle in `mod-search-grid.tsx`. */
  isConclave: boolean
  /** Tradable on Warframe Market. DE ships no tradability for upgrades, so
   *  this comes from wiki `Mods_data.Tradable`. Gates the Market link on the
   *  build-view detail popover. Defaults false. */
  tradable: boolean
  levelStats?: Array<{ stats: string[] }>
  modSet?: string
  modSetStats?: string[]
  /** Image URL, filled by build-items-index from the central image lookup
   *  (resolve-images.ts). */
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
  wikiIgnore: ReadonlySet<string>,
  wikiKnownNames: ReadonlySet<string>,
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
  // wiki-mod-flags.ts). The Game Mode toggle in the picker hides them
  // by default. We still count description-based hits for the build-time
  // diagnostic, but the count is informational only; emission decides PvP
  // membership.
  if (normalizeDescription(mod.description)?.includes("Conclave")) {
    counts.conclave++
  }
  if (DROPPED_MOD_NAMES.has(mod.name)) {
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
  if (DROPPED_MOD_UNIQUE_NAMES.has(uniqueName)) {
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
  polarity: Polarity
  rarity: Mod["rarity"]
  compatName: string
  type: string
  isAugment: boolean
  isPrime: boolean
  isExilus: boolean
  isConclave: boolean
  tradable: boolean
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
    tradable: parts.tradable,
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
  counts: FilterCounts
}

export interface MergeModsOpts {
  upgrades: DeUpgrade[]
  /** DE `ExportModSet` — set-bonus stats, attached per mod. */
  modSets?: DeUpgrade[]
  /** DE `ExportAvionics` — railjack Plexus mods. DE ships them with empty
   *  `compatName` and `type`, so they're tagged PLEXUS_MOD_TYPE here to
   *  match the runtime predicate (`isPlexusMod`). */
  avionics?: DeUpgrade[]
  /** OpenWF augmentation fields keyed by mod `uniqueName` (`compat`, tags). */
  pePlus?: Map<string, PePlusUpgradeFields>
  /** Wiki-sourced flags; a mod missing from a map defaults to false. */
  wiki?: Partial<
    Pick<
      WikiModFlags,
      "exilus" | "tradable" | "conclave" | "ignore" | "knownNames"
    >
  >
}

export function mergeMods(opts: MergeModsOpts): MergeModsResult {
  const {
    upgrades: rawUpgrades,
    modSets: rawModSets = [],
    avionics: rawAvionics = [],
    pePlus = new Map(),
  } = opts
  const {
    exilus: wikiExilus = new Map<string, boolean>(),
    tradable: wikiTradable = new Map<string, boolean>(),
    conclave: wikiConclave = new Set<string>(),
    ignore: wikiIgnore = new Set<string>(),
    // Gates the Primed-Expert allowance against DE's stream of unreleased
    // Primed mods (see shouldKeep). Keyed by Name rather than InternalName
    // because the wiki inconsistently includes the `/Expert/` infix.
    knownNames: wikiKnownNames = new Set<string>(),
  } = opts.wiki ?? {}

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
          `Add to POLARITY_TABLE in packages/shared/src/warframe/polarities.ts.`,
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
    let rarity: Mod["rarity"]
    if (raw.name.startsWith("Amalgam ")) rarity = "Amalgam"
    else if (raw.name.startsWith("Galvanized ")) rarity = "Galvanized"
    else rarity = mapRarity(raw.rarity, { context: `mod ${raw.name}` })

    // Trim compatName — DE has " Itzal" (leading space), trailing whitespace
    // can leak in, etc. Preserve case so it matches weapon.modPools entries.
    let compatName = (raw.compatName ?? "").trim()
    // Beast-claw mods share compatName "Claws" with player melee Claws mods;
    // give them their own pool (see data/curated/beast-claws.ts).
    if (
      compatName === "Claws" &&
      BEAST_CLAW_MOD_PATHS.some((p) => raw.uniqueName?.includes(p))
    ) {
      compatName = BEAST_CLAW_POOL
    }

    const isPrime = PRIMED_MOD_PREFIXES.some((p) => raw.name.includes(p))
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
        tradable: wikiTradable.get(raw.uniqueName) ?? false,
        modSet: modSetRef,
        modSetStats,
      }),
    )
  }

  // Avionics bypass `shouldKeep` / type validation, which would drop them
  // for their empty `type` and `compatName`.
  for (const raw of rawAvionics) {
    if (!raw.name || !raw.uniqueName) continue
    if (DROPPED_MOD_NAMES.has(raw.name)) continue
    const polarityRaw = raw.polarity ?? ""
    const polarity = DE_POLARITY_MAP[polarityRaw] ?? null
    if (!polarity) {
      throw new Error(
        `Unknown DE polarity "${polarityRaw}" on avionic ${raw.name}. ` +
          `Add to POLARITY_TABLE in packages/shared/src/warframe/polarities.ts.`,
      )
    }
    const rarity = mapRarity(raw.rarity, { context: `avionic ${raw.name}` })
    const plus = pePlus.get(raw.uniqueName)
    mods.push(
      toMergedMod(raw, plus, {
        polarity,
        rarity,
        // `getModsForItem` filters by `mod.compatName ∈ modPools` and the
        // Plexus item's modPools is [PLEXUS_POOL]; sub-slot routing
        // (Battle/Tactical/Integrated) goes by uniqueName path and `type`.
        compatName: PLEXUS_POOL,
        type: PLEXUS_MOD_TYPE,
        isAugment: false,
        isPrime: false,
        isExilus: false,
        isConclave: false,
        tradable: false,
      }),
    )
    counts.total++
    counts.kept++
  }

  // Primed/Umbral variants inherit their base mod's exilus eligibility. DE
  // ships no exilus flag and the wiki's `IsExilus` is keyed per-uniqueName, so
  // a Primed variant of an exilus mod is silently missed whenever the wiki row
  // for that variant lacks the flag (e.g. Primed Steady Hands, Primed Rifle/
  // Shotgun Ammo Mutation). The base mod is authoritative; only inherit upward
  // — never clear a flag the variant already carries. Base name is the variant
  // name minus the "Primed "/"Umbral " prefix; a variant whose base can't be
  // resolved by name (e.g. Umbral Fiber → "Fiber", no such mod) is left as-is.
  const exilusBaseNames = new Set<string>()
  for (const m of mods) {
    if (m.isExilus && !m.isPrime) exilusBaseNames.add(m.name)
  }
  for (const m of mods) {
    if (m.isExilus || !m.isPrime) continue
    const base = modVariantBase(m.name, PRIMED_MOD_PREFIXES)
    if (base !== undefined && exilusBaseNames.has(base)) {
      m.isExilus = true
    }
  }

  return { mods, counts }
}
