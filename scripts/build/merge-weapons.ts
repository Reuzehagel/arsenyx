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
 *   - DE weapon with no wiki match — emitted with empty modPools, displayClass null
 */

import { KNOWN_PRODUCT_CATEGORIES, type DeWeapon } from "./read-de"
import type { CuratedData } from "./read-curated"
import {
  buildDamageBlock,
  damageFromDePerShot,
  type AttackOut,
} from "./merge-damage"
import { normalizePolarity, normalizePolarities } from "./polarity"
import { cleanDeName } from "./names"

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
  "Kavat Claws", "Kubrow Claws", "Helminth Claws", "BeastClaws",
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
  const baseList =
    opts.curated.modPoolOverrides[cleanName] ??
    stub?.modPools ??
    (archPool ? [archPool] : undefined) ??
    (displayClass ? opts.curated.classPools[displayClass] : undefined) ??
    []
  const modPoolsSet = new Set<string>(baseList)
  modPoolsSet.add(cleanName)
  const base = baseWeaponName(cleanName)
  if (base) modPoolsSet.add(base)
  addNoAoePools(modPoolsSet, wiki?.CompatibilityTags)
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
    !dmg.damage && de.damagePerShot ? damageFromDePerShot(de.damagePerShot) : undefined

  // Arch-guns deployed atmospherically have a separate wiki entry
  // (`Foo (Atmosphere)`) with different damage tables. Fold those into
  // atmospheric* fields on the base weapon so the browse list stays
  // consolidated; the editor toggles between presentations.
  const atmosWiki = opts.wikiByName.get(`${cleanName} (Atmosphere)`)
  const atmosDmg = atmosWiki?.Attacks ? buildDamageBlock(atmosWiki.Attacks) : null

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
    if (user.endsWith(" Kavat")) modPoolsSet.add("Kavat Claws")
    if (user.endsWith(" Kubrow")) modPoolsSet.add("Kubrow Claws")
    if (user === "Helminth Charger") {
      modPoolsSet.add("Helminth Claws")
      modPoolsSet.add("Kubrow Claws")
    }
    // The pet name itself (Sahasa Kubrow etc.) is what per-pet mods
    // target — but those mods are pet-side, not claws-side. We don't
    // add them here; companion modPools handle that.
  }
  addNoAoePools(modPoolsSet, wiki.CompatibilityTags)
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
