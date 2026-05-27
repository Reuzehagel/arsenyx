/**
 * Merge DE PublicExport + wiki Lua + curated overrides into our internal
 * weapon shape.
 *
 * The merge implements the three-field model from
 * data-architecture.html, with one deviation that fell out of inspecting
 * the actual DE compatName vocabulary: **modPool is a LIST, not a single
 * string** (see implementation-notes.html for the why — a sniper rifle
 * accepts both "Rifle" mods and "Sniper" mods, an Excalibur accepts both
 * "WARFRAME" mods and "Excalibur" augments, etc.).
 *
 * Inputs:
 *   DE weapon record (uniqueName + name + productCategory + raw stats)
 *   Wiki record by name (Class, Slot, Family, Polarities, ExilusPolarity,
 *                        CompatibilityTags, Traits, Mastery)
 *   Curated overrides (mod-pool routing, wiki stubs for new weapons)
 *
 * Outputs:
 *   MergedWeapon — what the per-item detail file emits.
 *
 * Fail-loud assertions:
 *   - DE productCategory not in KNOWN_PRODUCT_CATEGORIES
 *   - Wiki Class not in KNOWN_WIKI_CLASSES (built from class-pools.ts keys)
 *   - Computed modPool member not in KNOWN_MOD_POOLS
 *
 * Soft-loud assertions (logged warnings, not throws):
 *   - DE weapon with no wiki match — emitted with empty modPools, displayClass null
 */

import { KNOWN_PRODUCT_CATEGORIES, type DeWeapon } from "./read-de"
import type { CuratedData } from "./read-curated"

/** Polarity values we recognize from wiki Lua. Lowercased for storage.
 *  The UI's existing codec already abbreviates these (see mods.ts), so we
 *  keep the long-form here and let consumers map. */
const KNOWN_POLARITIES = new Set<string>([
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
  "aura",
  "universal",
  "exilus",
  "any",
])

/** Closed set of mod pools the build will route to. Asserted on; extend
 *  here when you also extend `CLASS_DEFAULT_POOLS` or `mod-pools.ts`. */
export const KNOWN_MOD_POOLS = new Set<string>([
  // Generic per-slot pools
  "Rifle", "Shotgun", "Pistol", "Melee",
  // Refinements
  "Sniper", "Bow", "Tome", "Thrown",
  "Assault Rifle", "Rifle (No Aoe)", "Pistol (No Aoe)",
  // Stance compat (note PLURAL in DE compatName)
  "Polearms", "Hammers", "Swords", "Dual Swords",
  "Heavy Blade", "Heavy Scythe", "Scythes",
  "Daggers", "Dual Daggers",
  "Fists", "Sparring", "Staves",
  "Nikanas", "Dual Nikanas", "Two-Handed Nikana",
  "Tonfas", "Rapiers", "Glaives", "Gunblade",
  "Machetes", "Whips", "Blade And Whip",
  "Warfans", "Nunchaku", "Sword And Shield",
  "Thrown Melee", "Claws", "Assault Saw",
  // Companion / archwing / railjack
  "Archgun", "Archmelee", "Archwing",
  "Sentinel", "BEAST", "COMPANION", "ROBOTIC", "Hound", "Moa", "Kavat", "Kubrow",
  // Operator / modular / synthetic
  "Necramech", "Parazon", "Plexus", "Amp", "K-Drive",
  // Frame umbrella (matched by warframe items, not weapons — kept here so a
  // Class entry that hits "Warframe" doesn't accidentally assert false)
  "WARFRAME", "AURA", "ANY",
])

export interface MergedWeapon {
  uniqueName: string
  name: string
  /** Wiki `Class`, e.g. "Arm-Cannon", "Sniper Rifle", "Polearm" — user-facing. */
  displayClass: string | null
  /** DE compatNames this weapon's mod pool accepts. May include the weapon's
   *  own name to match weapon-specific augment mods. */
  modPools: readonly string[]
  /** Capability refinement tags from wiki CompatibilityTags. */
  compatTags: readonly string[]
  /** Polarity abbreviations for the eight upgrade slots, e.g. ["D","V","R"].
   *  Empty array means wiki doesn't have polarities for this weapon. */
  polarities: readonly string[]
  /** Exilus polarity, or null if none. */
  exilusPolarity: string | null
  /** Variant family (e.g. "Bubonico" for Coda Bubonico). */
  family: string | null
  /** Wiki Slot value: "Primary" / "Secondary" / "Melee" / "Archwing" / etc. */
  slot: string | null
  /** Wiki Traits: ["Tenno","Infested","Grineer","Corpus","Sentient","Tennokai", …] */
  traits: readonly string[]
  /** Mastery rank requirement. */
  masteryReq: number
  /** Kept from DE for low-level routing — coarse 8-value enum. */
  productCategory: string
  /** Raw DE stats — DE wins for numeric game values. */
  fireRate?: number
  magazineSize?: number
  reloadTime?: number
  totalDamage?: number
  damagePerShot?: number[]
  criticalChance?: number
  criticalMultiplier?: number
  procChance?: number
  accuracy?: number
  multishot?: number
  trigger?: string
  maxLevelCap?: number
}

interface WikiWeapon {
  Name?: string
  Class?: string
  Slot?: string
  Family?: string
  Polarities?: readonly unknown[]
  ExilusPolarity?: string
  CompatibilityTags?: readonly unknown[]
  Traits?: readonly unknown[]
  Mastery?: number
}

function normalizePolarity(p: unknown): string | null {
  if (typeof p !== "string" || p.length === 0) return null
  const lower = p.toLowerCase()
  if (!KNOWN_POLARITIES.has(lower)) {
    // Wiki sometimes uses fancy capitalization or trailing space — log so
    // we can audit, but pass through verbatim to keep merge non-throwing.
    return lower
  }
  return lower
}

/** Strip the Coda / Kuva / Tenet prefix from a variant name to recover the
 *  base weapon name (for augment-mod matching). */
const VARIANT_PREFIXES = ["Coda ", "Kuva ", "Tenet "] as const

function baseWeaponName(name: string): string | null {
  for (const p of VARIANT_PREFIXES) {
    if (name.startsWith(p)) return name.slice(p.length)
  }
  return null
}

/** DE prefixes some archwing weapons with `<ARCHWING> ` in their `name`
 *  field. The wiki keys them without the prefix, so we strip it for both
 *  wiki lookup and the canonical emitted name. */
const ARCHWING_PREFIX = "<ARCHWING> "

function cleanDeName(name: string): string {
  return name.startsWith(ARCHWING_PREFIX)
    ? name.slice(ARCHWING_PREFIX.length)
    : name
}

export interface MergeWeaponOpts {
  curated: CuratedData
  /** Wiki record keyed by weapon name (after alias resolution). */
  wikiByName: Map<string, WikiWeapon>
  /** Tracks DE weapons with no wiki match — populated by mergeWeapon. */
  unmatched: Set<string>
}

export function mergeWeapon(
  de: DeWeapon,
  opts: MergeWeaponOpts,
): MergedWeapon {
  if (!KNOWN_PRODUCT_CATEGORIES.has(de.productCategory)) {
    throw new Error(
      `Unknown DE productCategory "${de.productCategory}" on ${de.name} ` +
        `(${de.uniqueName}). Add to KNOWN_PRODUCT_CATEGORIES.`,
    )
  }

  // Strip the `<ARCHWING> ` prefix DE puts on archwing weapons so wiki
  // lookup (which uses bare names) matches.
  const cleanName = cleanDeName(de.name)
  const alias = opts.curated.wikiAliases[cleanName]
  const wiki: WikiWeapon | undefined =
    opts.wikiByName.get(alias ?? cleanName) ??
    // Try base name (Coda Bubonico → Bubonico)
    opts.wikiByName.get(baseWeaponName(cleanName) ?? "")
  const stub = opts.curated.wikiStubs[de.uniqueName]

  if (!wiki && !stub) {
    opts.unmatched.add(cleanName)
  }

  const displayClass =
    (wiki?.Class as string | undefined) ?? stub?.displayClass ?? null

  if (displayClass && !(displayClass in opts.curated.classPools)) {
    throw new Error(
      `Unknown wiki Class "${displayClass}" on ${de.name}. ` +
        `Add to data/curated/class-pools.ts.`,
    )
  }

  // Compute modPools:
  //   1. class default (from class-pools.ts)
  //   2. per-name override (mod-pools.ts) — REPLACES class default
  //   3. weapon's own name (for augment matching)
  //   4. base name if it's a Coda/Kuva/Tenet variant
  const baseList =
    opts.curated.modPoolOverrides[cleanName] ??
    stub?.modPools ??
    (displayClass ? opts.curated.classPools[displayClass] : undefined) ??
    []
  const modPoolsSet = new Set<string>(baseList)
  modPoolsSet.add(cleanName)
  const base = baseWeaponName(cleanName)
  if (base) modPoolsSet.add(base)
  const modPools = [...modPoolsSet]

  // Fail loud only on the "structural" pool buckets — weapon-name pool
  // entries are dynamically added per-item and are deliberately not in
  // KNOWN_MOD_POOLS (every augmented weapon would need to be enumerated).
  for (const p of baseList) {
    if (!KNOWN_MOD_POOLS.has(p)) {
      throw new Error(
        `Unknown modPool "${p}" routed from ${de.name} (Class=${displayClass}). ` +
          `Add to KNOWN_MOD_POOLS in scripts/build/merge-weapons.ts.`,
      )
    }
  }

  const polarities = (wiki?.Polarities ?? stub?.polarities ?? [])
    .map(normalizePolarity)
    .filter((p): p is string => p !== null)
  const exilus = normalizePolarity(wiki?.ExilusPolarity ?? stub?.exilusPolarity)
  return {
    uniqueName: de.uniqueName,
    name: cleanName,
    displayClass,
    modPools,
    compatTags: (wiki?.CompatibilityTags as readonly string[] | undefined) ?? [],
    polarities,
    exilusPolarity: exilus,
    family: (wiki?.Family as string | undefined) ?? stub?.family ?? null,
    slot: (wiki?.Slot as string | undefined) ?? null,
    traits: (wiki?.Traits as readonly string[] | undefined) ?? [],
    masteryReq: (wiki?.Mastery ?? de.masteryReq ?? 0) as number,
    productCategory: de.productCategory,
    fireRate: de.fireRate,
    magazineSize: de.magazineSize,
    reloadTime: de.reloadTime,
    totalDamage: de.totalDamage,
    damagePerShot: de.damagePerShot,
    criticalChance: de.criticalChance,
    criticalMultiplier: de.criticalMultiplier,
    procChance: de.procChance,
    accuracy: de.accuracy,
    multishot: de.multishot,
    trigger: de.trigger,
    maxLevelCap: de.maxLevelCap,
  }
}

/**
 * Build a MergedWeapon record from a wiki-only entry (no DE row exists).
 * Beast claws are the canonical case — DE doesn't export them as weapons,
 * but the wiki has them under Module:Weapons/data/companion with full
 * damage tables.
 */
export function mergeWikiOnlyWeapon(
  name: string,
  wiki: WikiWeapon & { InternalName?: string },
  curated: CuratedData,
): MergedWeapon {
  const displayClass = (wiki.Class as string | undefined) ?? null
  if (displayClass && !(displayClass in curated.classPools)) {
    throw new Error(
      `Unknown wiki Class "${displayClass}" on wiki-only entry ${name}. ` +
        `Add to data/curated/class-pools.ts.`,
    )
  }

  const baseList =
    curated.modPoolOverrides[name] ??
    (displayClass ? curated.classPools[displayClass] : undefined) ??
    []
  for (const p of baseList) {
    if (!KNOWN_MOD_POOLS.has(p)) {
      throw new Error(
        `Unknown modPool "${p}" routed from wiki-only ${name}. ` +
          `Add to KNOWN_MOD_POOLS.`,
      )
    }
  }
  const modPoolsSet = new Set<string>(baseList)
  modPoolsSet.add(name)
  const modPools = [...modPoolsSet]

  const polarities = (wiki.Polarities ?? [])
    .map(normalizePolarity)
    .filter((p): p is string => p !== null)
  const exilus = normalizePolarity(wiki.ExilusPolarity)
  return {
    // Wiki InternalName is DE's uniqueName when present; otherwise synthesize
    // one off the weapon's name.
    uniqueName:
      (wiki.InternalName as string | undefined) ??
      `/Lotus/WikiOnly/${name.replace(/\s+/g, "")}`,
    name,
    displayClass,
    modPools,
    compatTags: (wiki.CompatibilityTags as readonly string[] | undefined) ?? [],
    polarities,
    exilusPolarity: exilus,
    family: (wiki.Family as string | undefined) ?? null,
    slot: (wiki.Slot as string | undefined) ?? null,
    traits: (wiki.Traits as readonly string[] | undefined) ?? [],
    masteryReq: (wiki.Mastery ?? 0) as number,
    productCategory: "Wiki-Only",
  }
}

/** Concentric checks of the curated data shape. Run once at build start so
 *  config errors fail fast rather than mid-loop. */
export function validateCuratedAgainstKnown(curated: CuratedData): void {
  for (const pool of curated.allMentionedPools) {
    if (!KNOWN_MOD_POOLS.has(pool)) {
      throw new Error(
        `class-pools.ts mentions pool "${pool}" not in KNOWN_MOD_POOLS. ` +
          `Either add it to KNOWN_MOD_POOLS in merge-weapons.ts or fix the typo.`,
      )
    }
  }
  for (const [_name, pools] of Object.entries(curated.modPoolOverrides)) {
    for (const pool of pools) {
      if (!KNOWN_MOD_POOLS.has(pool)) {
        throw new Error(
          `mod-pools.ts override for "${_name}" mentions pool "${pool}" ` +
            `not in KNOWN_MOD_POOLS.`,
        )
      }
    }
  }
}
