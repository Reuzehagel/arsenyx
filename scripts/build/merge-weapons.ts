/**
 * Merge DE PublicExport + wiki Lua + curated overrides into our internal
 * weapon shape.
 *
 * Note that **modPool is a LIST, not a single string**: a sniper rifle
 * accepts both "Rifle" mods and "Sniper" mods, an Excalibur accepts both
 * "WARFRAME" mods and "Excalibur" augments, etc.
 *
 * Inputs:
 *   DE weapon record (uniqueName + name + productCategory + raw stats)
 *   Wiki record by name (Class, Slot, Family, Polarities, ExilusPolarity,
 *                        Traits, Mastery)
 *   Curated overrides (mod-pool routing, wiki aliases)
 *
 * Outputs:
 *   MergedWeapon — what the per-item detail file emits.
 *
 * Fail-loud assertions:
 *   - DE productCategory not in KNOWN_PRODUCT_CATEGORIES
 *   - Wiki Class not a key of CLASS_DEFAULT_POOLS (class-pools.ts)
 *   - A curated or routed pool not in KNOWN_MOD_POOLS (validateCuratedPools,
 *     once at build start)
 *
 * Soft-loud assertions (logged warnings, not throws):
 *   - DE weapon with no wiki match — `displayClass` is null and most
 *     wiki-sourced fields (polarities, traits, attacks) are empty. If DE has
 *     given it a riven disposition (a real playable weapon), it still gets a
 *     generic per-slot mod pool by productCategory (see
 *     WIKILESS_PRODUCT_CATEGORIES in categorize.ts)
 *     so it stays MODDABLE until the wiki documents it; otherwise modPools is
 *     just its own name and `categorizeWeapon` drops it as noise.
 */

import {
  BEAST_CLAW_CLASS,
  BEAST_CLAW_POOL,
} from "@arsenyx/shared/warframe/mods"
import { PLEXUS_POOL } from "@arsenyx/shared/warframe/plexus"
import { LICH_PREFIXES } from "@arsenyx/shared/warframe/types"

import { BEAST_CLAW_USER_POOLS } from "../../data/curated/beast-claws"
import { CLASS_DEFAULT_POOLS } from "../../data/curated/class-pools"
import { MOD_POOL_OVERRIDES } from "../../data/curated/mod-pools"
import { WIKI_ALIASES } from "../../data/curated/wiki-aliases"
import { WIKILESS_PRODUCT_CATEGORIES } from "./categorize"
import type { DeWeapon } from "./de-types"
import {
  buildDamageBlock,
  damageFromDePerShot,
  type AttackOut,
} from "./merge-damage"
import { ATMOSPHERE_SLOT, atmosphereVariantName, cleanDeName } from "./names"
import { normalizePolarity, normalizePolarities } from "./polarity"
import { KNOWN_PRODUCT_CATEGORIES } from "./read-de"

/** Closed set of mod pools the build will route to. Asserted on; extend
 *  here when you also extend `CLASS_DEFAULT_POOLS` or `mod-pools.ts`. */
const KNOWN_MOD_POOLS = new Set<string>([
  // Generic per-slot pools
  "Rifle",
  "Shotgun",
  "Pistol",
  "Melee",
  // Slot-wide pools (DE compatName for mods that fit any weapon in a slot —
  // e.g. Hunter Munitions / Vigilante set / Aero Periphery are "PRIMARY", not
  // "Rifle"). Supersets of the granular pools above; added by addSlotWidePools.
  "PRIMARY",
  "SECONDARY",
  "MELEE",
  // Refinements
  "Sniper",
  "Bow",
  "Tome",
  "Thrown",
  "Assault Rifle",
  "Rifle (No Aoe)",
  "Pistol (No Aoe)",
  // Stance compat (note PLURAL in DE compatName)
  "Polearms",
  "Hammers",
  "Swords",
  "Dual Swords",
  "Heavy Blade",
  "Heavy Scythe",
  "Scythes",
  "Daggers",
  "Dual Daggers",
  "Fists",
  "Sparring",
  "Staves",
  "Nikanas",
  "Dual Nikanas",
  "Two-Handed Nikana",
  "Tonfas",
  "Rapiers",
  "Glaives",
  "Gunblade",
  "Machetes",
  "Whips",
  "Blade And Whip",
  "Warfans",
  "Nunchaku",
  "Sword And Shield",
  "Thrown Melee",
  "Claws",
  "Assault Saw",
  "Bayonet",
  // Companion / archwing / railjack
  "Archgun",
  "Archmelee",
  "Archwing",
  "Sentinel",
  "BEAST",
  "COMPANION",
  "ROBOTIC",
  "Hound",
  "Moa",
  "Kavat",
  "Kubrow",
  "Kavat Claws",
  "Kubrow Claws",
  "Helminth Claws",
  BEAST_CLAW_POOL,
  // Operator / modular / synthetic
  "Necramech",
  "Parazon",
  PLEXUS_POOL,
  "Amp",
  "K-Drive",
  // Frame umbrella (matched by warframe items, not weapons — kept here so a
  // Class entry that hits "Warframe" doesn't accidentally assert false)
  "WARFRAME",
  "AURA",
  "ANY",
])

export interface MergedWeapon {
  uniqueName: string
  name: string
  /** Wiki `Class`, e.g. "Arm-Cannon", "Sniper Rifle", "Polearm" — user-facing. */
  displayClass: string | null
  /** DE compatNames this weapon's mod pool accepts. May include the weapon's
   *  own name to match weapon-specific augment mods. */
  modPools: readonly string[]
  /** Lowercase polarity names for the upgrade slots, e.g. ["madurai"].
   *  Empty array means wiki doesn't have polarities for this weapon. */
  polarities: readonly string[]
  /** Exilus polarity, or null if none. */
  exilusPolarity: string | null
  /** Stance slot polarity for melees (and some exalted melees). Null when the
   *  weapon has no stance slot (arch-melee, zaw strikes, non-melee). */
  stancePolarity: string | null
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
  /** DE riven disposition. Present only on real, playable weapons — used as
   *  the "this is a genuine weapon" signal when a weapon has no wiki page. */
  omegaAttenuation?: number
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
  /** Per-attack-mode breakdown sourced from wiki Attacks. Empty when
   *  wiki has no attack data (rare — railjack turrets, modular Plexus). */
  attacks?: AttackOut[]
  /** Normal Attack damage dict (lowercased element keys, nonzero only).
   *  Mirrors first-attack values for legacy stats-panel rendering. */
  damage?: Record<string, number>
  /** Atmospheric-deployment damage variant for arch-guns (deployed on the
   *  ground via Archgun Deployer). Populated only when the wiki ships a
   *  separate `Foo (Atmosphere)` entry for the weapon. The editor toggles
   *  the stats panel between space and atmospheric using these fields. */
  atmosphericAttacks?: AttackOut[]
  atmosphericDamage?: Record<string, number>
  atmosphericTotalDamage?: number
}

interface WikiWeapon {
  Name?: string
  Class?: string
  Slot?: string
  Family?: string
  Polarities?: readonly unknown[]
  ExilusPolarity?: string
  StancePolarity?: string
  Traits?: readonly unknown[]
  Mastery?: number
  Attacks?: readonly Record<string, unknown>[]
  Image?: string
  /** DE compatibility flags ("PROJECTILE", "AOE", "BEAM", …). The "AOE" tag is
   *  the authoritative marker for whether a weapon counts as area-of-effect —
   *  DE's export has no such field, so this is the only source. */
  CompatibilityTags?: readonly unknown[]
}

/**
 * Mods tagged "Rifle (No Aoe)" / "Pistol (No Aoe)" (e.g. Energizing Shot)
 * equip on rifle/pistol-pool weapons that DE does NOT classify as AoE. A
 * weapon accepts them unless its wiki `CompatibilityTags` include "AOE" — so
 * weapons with only incidental self-explosions (Sporelacer, Catchmoon) and
 * untagged weapons qualify, while true AoE launchers (Tombfinger, Kompressa)
 * do not. Mutates the pool set in place. Only Rifle/Pistol have a No-Aoe mod
 * pool; Shotgun does not.
 */
export function addNoAoePools(
  pools: Set<string>,
  compatTags: readonly unknown[] | undefined,
): void {
  const isAoE = (compatTags ?? []).some(
    (t) => String(t).toUpperCase() === "AOE",
  )
  if (isAoE) return
  if (pools.has("Rifle")) pools.add("Rifle (No Aoe)")
  if (pools.has("Pistol")) pools.add("Pistol (No Aoe)")
}

/** Granular slot pools that imply membership in a slot-wide DE pool. A weapon
 *  taking any "Rifle"/"Shotgun"/"Bow"/… mod also takes "PRIMARY" mods (Hunter
 *  Munitions, Vigilante set, Aero Periphery), and likewise for SECONDARY/MELEE.
 *  Beast claws (BeastClaws/Claws pools) and archwing pools deliberately don't
 *  appear here — they have their own routing. */
const PRIMARY_GRANULAR_POOLS = [
  "Rifle",
  "Shotgun",
  "Sniper",
  "Bow",
  "Assault Rifle",
] as const
const SECONDARY_GRANULAR_POOLS = ["Pistol", "Thrown", "Tome"] as const
const MELEE_GRANULAR_POOLS = ["Melee"] as const

/**
 * Add the slot-wide DE pool ("PRIMARY"/"SECONDARY"/"MELEE") implied by the
 * granular slot pools already present. DE ships slot-wide mods (Hunter
 * Munitions, Vigilante Armaments, Aero Periphery, …) with compatName "PRIMARY"
 * rather than "Rifle", so without this they match no weapon. Mutates in place;
 * call last so it sees the final granular pools.
 */
export function addSlotWidePools(pools: Set<string>): void {
  if (PRIMARY_GRANULAR_POOLS.some((p) => pools.has(p))) pools.add("PRIMARY")
  if (SECONDARY_GRANULAR_POOLS.some((p) => pools.has(p))) pools.add("SECONDARY")
  if (MELEE_GRANULAR_POOLS.some((p) => pools.has(p))) pools.add("MELEE")
}

/** Strip the Coda / Kuva / Tenet prefix from a variant name to recover the
 *  base weapon name (for augment-mod matching). */
function baseWeaponName(name: string): string | null {
  for (const p of LICH_PREFIXES) {
    if (name.startsWith(p)) return name.slice(p.length)
  }
  return null
}

/** Wiki Class → displayClass, failing loud on a Class with no pool routing. */
function wikiClass(cls: string | undefined, context: string): string | null {
  if (cls && !(cls in CLASS_DEFAULT_POOLS)) {
    throw new Error(
      `Unknown wiki Class "${cls}" on ${context}. ` +
        `Add to data/curated/class-pools.ts.`,
    )
  }
  return cls ?? null
}

/** Extra pools a beast claw gets from the companion wielding it. */
function beastClawPools(user: string): string[] {
  return BEAST_CLAW_USER_POOLS.filter(
    (r) => r.suffixes?.some((s) => user.endsWith(s)) || r.users?.includes(user),
  ).flatMap((r) => r.pools)
}

/**
 * A weapon's modPools. The base list is the first of:
 *   1. per-name override (mod-pools.ts) — REPLACES class default
 *   2. archwing slot pool — every arch-gun routes to Archgun and every
 *      arch-melee to Archmelee, even when the wiki Class is a *ground* class
 *      (Arbucep, an Arch-gun the wiki labels "Launcher", would otherwise
 *      inherit "Rifle" and show primary mods)
 *   3. class default (class-pools.ts)
 *   4. `wikilessPool` — a brand-new real weapon not yet on the wiki
 *      (WIKILESS_PRODUCT_CATEGORIES)
 * then the weapon's own name (augment matching), its base name if it's a
 * Coda/Kuva/Tenet variant, `extra`, and the No-Aoe / slot-wide pools.
 */
function computeModPools(opts: {
  name: string
  displayClass: string | null
  slot: string | null
  wikilessPool?: string
  extra?: readonly string[]
  compatTags: readonly unknown[] | undefined
}): string[] {
  const { name, displayClass, slot } = opts
  const archPool =
    slot === "Archgun" || slot === ATMOSPHERE_SLOT
      ? "Archgun"
      : slot === "Archmelee"
        ? "Archmelee"
        : null
  const baseList =
    MOD_POOL_OVERRIDES[name] ??
    (archPool ? [archPool] : undefined) ??
    (displayClass ? CLASS_DEFAULT_POOLS[displayClass] : undefined) ??
    (opts.wikilessPool ? [opts.wikilessPool] : undefined) ??
    []
  const pools = new Set<string>(baseList)
  pools.add(name)
  const base = baseWeaponName(name)
  if (base) pools.add(base)
  for (const p of opts.extra ?? []) pools.add(p)
  addNoAoePools(pools, opts.compatTags)
  addSlotWidePools(pools)
  return [...pools]
}

export interface MergeWeaponOpts {
  /** Wiki record keyed by weapon name (after alias resolution). */
  wikiByName: Map<string, WikiWeapon>
  /** Tracks DE weapons with no wiki match — populated by mergeWeapon. */
  unmatched: Set<string>
}

export function mergeWeapon(de: DeWeapon, opts: MergeWeaponOpts): MergedWeapon {
  if (!KNOWN_PRODUCT_CATEGORIES.has(de.productCategory)) {
    throw new Error(
      `Unknown DE productCategory "${de.productCategory}" on ${de.name} ` +
        `(${de.uniqueName}). Add to KNOWN_PRODUCT_CATEGORIES.`,
    )
  }

  // Strip the `<ARCHWING> ` prefix DE puts on archwing weapons so wiki
  // lookup (which uses bare names) matches.
  const cleanName = cleanDeName(de.name)
  const alias = WIKI_ALIASES[cleanName]
  const wiki: WikiWeapon | undefined =
    opts.wikiByName.get(alias ?? cleanName) ??
    // Try base name (Coda Bubonico → Bubonico)
    opts.wikiByName.get(baseWeaponName(cleanName) ?? "")
  if (!wiki) opts.unmatched.add(cleanName)

  const displayClass = wikiClass(wiki?.Class, de.name)
  const slot = wiki?.Slot ?? null
  const modPools = computeModPools({
    name: cleanName,
    displayClass,
    slot,
    // Only weapons DE gave a riven disposition — real playable ones — so
    // DE's internal/unreleased noise stays out.
    wikilessPool:
      de.omegaAttenuation !== undefined
        ? WIKILESS_PRODUCT_CATEGORIES[de.productCategory]?.pool
        : undefined,
    compatTags: wiki?.CompatibilityTags,
  })

  // Damage shape: wiki Attacks is the rich source. Fall back to DE
  // damagePerShot[20] when the wiki has no attacks (railjack, modular).
  const dmg = buildDamageBlock(wiki?.Attacks)
  const fallbackDamage =
    !dmg.damage && de.damagePerShot
      ? damageFromDePerShot(de.damagePerShot)
      : undefined

  // Arch-guns deployed atmospherically have a separate wiki entry
  // (`Foo (Atmosphere)`) with different damage tables. Fold those into
  // atmospheric* fields on the base weapon so the browse list stays
  // consolidated; the editor toggles between presentations.
  const atmosWiki = opts.wikiByName.get(atmosphereVariantName(cleanName))
  const atmosDmg = atmosWiki?.Attacks
    ? buildDamageBlock(atmosWiki.Attacks)
    : null

  return {
    uniqueName: de.uniqueName,
    name: cleanName,
    displayClass,
    modPools,
    polarities: normalizePolarities(wiki?.Polarities ?? []),
    exilusPolarity: normalizePolarity(wiki?.ExilusPolarity),
    stancePolarity: normalizePolarity(wiki?.StancePolarity),
    family: wiki?.Family ?? null,
    slot,
    traits: (wiki?.Traits as readonly string[] | undefined) ?? [],
    masteryReq: (wiki?.Mastery ?? de.masteryReq ?? 0) as number,
    productCategory: de.productCategory,
    omegaAttenuation: de.omegaAttenuation,
    fireRate: de.fireRate,
    magazineSize: de.magazineSize,
    reloadTime: de.reloadTime,
    totalDamage: dmg.totalDamage ?? de.totalDamage,
    damagePerShot: de.damagePerShot,
    criticalChance: de.criticalChance,
    criticalMultiplier: de.criticalMultiplier,
    procChance: de.procChance,
    accuracy: de.accuracy,
    multishot: de.multishot,
    trigger: de.trigger,
    maxLevelCap: de.maxLevelCap,
    attacks: dmg.attacks,
    damage: dmg.damage ?? fallbackDamage,
    atmosphericAttacks: atmosDmg?.attacks,
    atmosphericDamage: atmosDmg?.damage,
    atmosphericTotalDamage: atmosDmg?.totalDamage,
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
  wiki: WikiWeapon & {
    InternalName?: string
    Users?: readonly string[]
  },
): MergedWeapon {
  const displayClass = wikiClass(wiki.Class, `wiki-only entry ${name}`)
  const isBeastClaw = displayClass === BEAST_CLAW_CLASS
  const user = isBeastClaw ? wiki.Users?.[0] : undefined
  const modPools = computeModPools({
    name,
    displayClass,
    slot: wiki.Slot ?? null,
    extra: user === undefined ? [] : beastClawPools(user),
    compatTags: wiki.CompatibilityTags,
  })

  // Beast claws equip a Posture (stance) mod in a slot that is permanently
  // Penjaga — DE/wiki don't emit a StancePolarity for them, so default it here
  // so the editor surfaces the stance slot and a maxed Posture mod earns the
  // doubled +10 capacity. (wiki.warframe.com/w/Companion: "Beast Claw Stance
  // Mods and Slots all use the Penjaga Polarity".)
  const stance =
    normalizePolarity(wiki.StancePolarity) ?? (isBeastClaw ? "penjaga" : null)
  const dmg = buildDamageBlock(wiki.Attacks)
  return {
    // Wiki InternalName is DE's uniqueName when present; otherwise synthesize
    // one off the weapon's name.
    uniqueName:
      wiki.InternalName ?? `/Lotus/WikiOnly/${name.replace(/\s+/g, "")}`,
    name,
    displayClass,
    modPools,
    polarities: normalizePolarities(wiki.Polarities ?? []),
    exilusPolarity: normalizePolarity(wiki.ExilusPolarity),
    stancePolarity: stance,
    family: wiki.Family ?? null,
    slot: wiki.Slot ?? null,
    traits: (wiki.Traits as readonly string[] | undefined) ?? [],
    masteryReq: (wiki.Mastery ?? 0) as number,
    productCategory: "Wiki-Only",
    attacks: dmg.attacks,
    damage: dmg.damage,
    totalDamage: dmg.totalDamage,
  }
}

/** Fail fast at build start on a curated or routed pool KNOWN_MOD_POOLS
 *  doesn't list, rather than mid-loop. */
export function validateCuratedPools(): void {
  const sources: Array<[string, readonly string[]]> = [
    ["class-pools.ts", Object.values(CLASS_DEFAULT_POOLS).flat()],
    ...Object.entries(MOD_POOL_OVERRIDES).map(
      ([name, pools]) =>
        [`mod-pools.ts override for "${name}"`, pools] as [string, string[]],
    ),
    ["beast-claws.ts", BEAST_CLAW_USER_POOLS.flatMap((r) => r.pools)],
    [
      "WIKILESS_PRODUCT_CATEGORIES (categorize.ts)",
      Object.values(WIKILESS_PRODUCT_CATEGORIES).flatMap((c) =>
        c.pool ? [c.pool] : [],
      ),
    ],
  ]
  for (const [where, pools] of sources) {
    for (const pool of pools) {
      if (!KNOWN_MOD_POOLS.has(pool)) {
        throw new Error(
          `${where} mentions pool "${pool}" not in KNOWN_MOD_POOLS. ` +
            `Either add it to KNOWN_MOD_POOLS in merge-weapons.ts or fix the typo.`,
        )
      }
    }
  }
}
