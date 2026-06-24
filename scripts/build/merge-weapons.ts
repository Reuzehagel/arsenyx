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
 *   - DE weapon with no wiki match — `displayClass` is null and most
 *     wiki-sourced fields (polarities, traits, attacks) are empty. If DE has
 *     given it a riven disposition (a real playable weapon), it still gets a
 *     generic per-slot mod pool by productCategory (see PRODUCT_CATEGORY_POOL)
 *     so it stays MODDABLE until the wiki documents it; otherwise modPools is
 *     just its own name and `categorizeWeapon` drops it as noise.
 */

import {
  buildDamageBlock,
  damageFromDePerShot,
  type AttackOut,
} from "./merge-damage"
import { cleanDeName } from "./names"
import { normalizePolarity, normalizePolarities } from "./polarity"
import type { CuratedData } from "./read-curated"
import { KNOWN_PRODUCT_CATEGORIES, type DeWeapon } from "./read-de"

/** Closed set of mod pools the build will route to. Asserted on; extend
 *  here when you also extend `CLASS_DEFAULT_POOLS` or `mod-pools.ts`. */
export const KNOWN_MOD_POOLS = new Set<string>([
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
  "BeastClaws",
  // Operator / modular / synthetic
  "Necramech",
  "Parazon",
  "Plexus",
  "Amp",
  "K-Drive",
  // Frame umbrella (matched by warframe items, not weapons — kept here so a
  // Class entry that hits "Warframe" doesn't accidentally assert false)
  "WARFRAME",
  "AURA",
  "ANY",
])

/** Generic per-slot mod pool keyed by DE productCategory. The fallback that
 *  keeps a brand-new weapon — present in DE but not yet documented on the wiki
 *  (so no Class → no class pool) — MODDABLE until the wiki catches up. Applied
 *  only to weapons DE has assigned a riven disposition (`omegaAttenuation`),
 *  which it does for real playable weapons, so DE's internal/unreleased noise
 *  stays out. */
const PRODUCT_CATEGORY_POOL: Record<string, string> = {
  LongGuns: "Rifle",
  Pistols: "Pistol",
  Melee: "Melee",
  SpaceGuns: "Archgun",
  SpaceMelee: "Archmelee",
  // NOTE: keep in sync with the wikiless `productCategory` switch in
  // `categorizeWeapon` (categorize.ts). A category that routes there but is
  // missing here emits a wikiless weapon with no generic pool (own name only).
  // `SentinelWeapons` is deliberately absent: which generic pool sentinel
  // weapons accept is a game-mechanic fact we won't guess — add it (with a
  // verified pool) the day a wikiless sentinel weapon actually ships.
}

export interface MergedWeapon {
  uniqueName: string
  name: string
  /** Wiki `Class`, e.g. "Arm-Cannon", "Sniper Rifle", "Polearm" — user-facing. */
  displayClass: string | null
  /** DE compatNames this weapon's mod pool accepts. May include the weapon's
   *  own name to match weapon-specific augment mods. */
  modPools: readonly string[]
  /** Polarity abbreviations for the eight upgrade slots, e.g. ["D","V","R"].
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
  if (pools.has("Melee")) pools.add("MELEE")
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

export interface MergeWeaponOpts {
  curated: CuratedData
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
  const slot = (wiki?.Slot as string | undefined) ?? null

  if (displayClass && !(displayClass in opts.curated.classPools)) {
    throw new Error(
      `Unknown wiki Class "${displayClass}" on ${de.name}. ` +
        `Add to data/curated/class-pools.ts.`,
    )
  }

  // Archwing weapons whose wiki Class is a *ground*-weapon class — e.g.
  // Arbucep, an Arch-gun the wiki labels "Launcher" — would otherwise
  // inherit the ground pool ("Rifle") and show primary mods. The slot is
  // authoritative: route every arch-gun to the Archgun pool and every
  // arch-melee to Archmelee, regardless of the class label. (For a normal
  // arch-gun, Class="Archgun" already resolves to ["Archgun"], so this is a
  // no-op there.)
  const archPool =
    slot === "Archgun" || slot === "Archgun (Atmosphere)"
      ? "Archgun"
      : slot === "Archmelee"
        ? "Archmelee"
        : null

  // Compute modPools:
  //   1. per-name override (mod-pools.ts) — REPLACES class default
  //   2. curated wiki stub pools
  //   3. archwing slot pool (overrides a misleading ground class label)
  //   4. class default (from class-pools.ts)
  //   5. weapon's own name (for augment matching)
  //   6. base name if it's a Coda/Kuva/Tenet variant
  //   7. wiki-less fallback: a brand-new real weapon (has a riven disposition)
  //      not yet on the wiki gets a generic per-slot pool by DE productCategory
  //      so it's still moddable. See PRODUCT_CATEGORY_POOL.
  const wikilessPool =
    de.omegaAttenuation !== undefined
      ? PRODUCT_CATEGORY_POOL[de.productCategory]
      : undefined
  const baseList =
    opts.curated.modPoolOverrides[cleanName] ??
    stub?.modPools ??
    (archPool ? [archPool] : undefined) ??
    (displayClass ? opts.curated.classPools[displayClass] : undefined) ??
    (wikilessPool ? [wikilessPool] : undefined) ??
    []
  const modPoolsSet = new Set<string>(baseList)
  modPoolsSet.add(cleanName)
  const base = baseWeaponName(cleanName)
  if (base) modPoolsSet.add(base)
  addNoAoePools(modPoolsSet, wiki?.CompatibilityTags)
  addSlotWidePools(modPoolsSet)
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

  const polarities = normalizePolarities(
    wiki?.Polarities ?? stub?.polarities ?? [],
  )
  const exilus = normalizePolarity(wiki?.ExilusPolarity ?? stub?.exilusPolarity)
  const stance = normalizePolarity(wiki?.StancePolarity)

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
  const atmosWiki = opts.wikiByName.get(`${cleanName} (Atmosphere)`)
  const atmosDmg = atmosWiki?.Attacks
    ? buildDamageBlock(atmosWiki.Attacks)
    : null

  return {
    uniqueName: de.uniqueName,
    name: cleanName,
    displayClass,
    modPools,
    polarities,
    exilusPolarity: exilus,
    stancePolarity: stance,
    family: (wiki?.Family as string | undefined) ?? stub?.family ?? null,
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
  // Beast claws: derive Kavat/Kubrow pools from the wiki Users[0] field
  // (e.g. "Adarza Kavat", "Sahasa Kubrow"). Routes Swipe-style class-
  // specific claws mods (compat "Kavat Claws" / "Kubrow Claws") and
  // per-pet mods (compat "Adarza Kavat") to the right weapons.
  if (displayClass === "Claws (Beast)" && wiki.Users && wiki.Users.length > 0) {
    const user = wiki.Users[0]!
    // Vulpaphyla are infested catbrows and Predasites infested kubrows, so
    // their claws share the Kavat/Kubrow claw pools (e.g. Swipe — "Kavat
    // Claws" — equips on Sly/Crescent/Panzer Claws in-game; the wiki groups
    // the category as "Kavat Claws (Vulpaphyla Claws)").
    if (user.endsWith(" Kavat") || user.endsWith(" Vulpaphyla")) {
      modPoolsSet.add("Kavat Claws")
    }
    if (user.endsWith(" Kubrow") || user.endsWith(" Predasite")) {
      modPoolsSet.add("Kubrow Claws")
    }
    if (user === "Helminth Charger") {
      modPoolsSet.add("Helminth Claws")
      modPoolsSet.add("Kubrow Claws")
    }
    // The pet name itself (Sahasa Kubrow etc.) is what per-pet mods
    // target — but those mods are pet-side, not claws-side. We don't
    // add them here; companion modPools handle that.
  }
  addNoAoePools(modPoolsSet, wiki.CompatibilityTags)
  addSlotWidePools(modPoolsSet)
  const modPools = [...modPoolsSet]

  const polarities = normalizePolarities(wiki.Polarities ?? [])
  const exilus = normalizePolarity(wiki.ExilusPolarity)
  // Beast claws equip a Posture (stance) mod in a slot that is permanently
  // Penjaga — DE/wiki don't emit a StancePolarity for them, so default it here
  // so the editor surfaces the stance slot and a maxed Posture mod earns the
  // doubled +10 capacity. (wiki.warframe.com/w/Companion: "Beast Claw Stance
  // Mods and Slots all use the Penjaga Polarity".)
  const stance =
    normalizePolarity(wiki.StancePolarity) ??
    (displayClass === "Claws (Beast)" ? "penjaga" : null)
  const dmg = buildDamageBlock(wiki.Attacks)
  return {
    // Wiki InternalName is DE's uniqueName when present; otherwise synthesize
    // one off the weapon's name.
    uniqueName:
      (wiki.InternalName as string | undefined) ??
      `/Lotus/WikiOnly/${name.replace(/\s+/g, "")}`,
    name,
    displayClass,
    modPools,
    polarities,
    exilusPolarity: exilus,
    stancePolarity: stance,
    family: (wiki.Family as string | undefined) ?? null,
    slot: (wiki.Slot as string | undefined) ?? null,
    traits: (wiki.Traits as readonly string[] | undefined) ?? [],
    masteryReq: (wiki.Mastery ?? 0) as number,
    productCategory: "Wiki-Only",
    attacks: dmg.attacks,
    damage: dmg.damage,
    totalDamage: dmg.totalDamage,
  }
}

/** Validate the curated data shape. Run once at build start so config
 *  errors fail fast rather than mid-loop. */
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
