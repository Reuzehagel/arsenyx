import type { BrowseCategory, Mod, Polarity } from "./types"

export const RIVEN_UNIQUE_NAME = "/riven"
export const RIVEN_IMAGE_NAME = "rifle-riven-mod-e05c5519f1.png"

/** Polarities a riven mod can be rolled with. */
export const RIVEN_POLARITIES: readonly Polarity[] = [
  "madurai",
  "naramon",
  "vazarin",
] as const

/** Riven polarity drain reduction caps at 9 (default max cost). */
export const RIVEN_MAX_DRAIN = 18
export const RIVEN_MIN_DRAIN = 0

/** Stats available on gun (primary / secondary / archgun / companion) rivens. */
export const GUN_RIVEN_STATS = [
  "Critical Chance",
  "Critical Damage",
  "Damage",
  "Multishot",
  "Fire Rate",
  "Status Chance",
  "Status Duration",
  "Reload Speed",
  "Magazine Capacity",
  "Ammo Maximum",
  "Projectile Speed",
  "Punch Through",
  "Weapon Recoil",
  "Zoom",
  "Impact",
  "Puncture",
  "Slash",
  "Heat",
  "Cold",
  "Electricity",
  "Toxin",
  "Damage to Corpus",
  "Damage to Grineer",
  "Damage to Infested",
] as const

/** Stats available on melee rivens. */
export const MELEE_RIVEN_STATS = [
  "Critical Chance",
  "Critical Damage",
  "Damage",
  "Attack Speed",
  "Range",
  "Combo Duration",
  "Finisher Damage",
  "Slide Attack",
  "Channeling Damage",
  "Channeling Efficiency",
  "Status Chance",
  "Status Duration",
  "Impact",
  "Puncture",
  "Slash",
  "Heat",
  "Cold",
  "Electricity",
  "Toxin",
  "Damage to Corpus",
  "Damage to Grineer",
  "Damage to Infested",
] as const

export const RIVEN_ELIGIBLE_CATEGORIES = new Set<BrowseCategory>([
  "primary",
  "secondary",
  "melee",
  "companion-weapons",
])

/** Riven-eligible weapons per the wiki: Primary, Secondary, Melee,
 * Arch-Guns, and Robotic (companion) weapons. The `archwing` browse
 * category lumps Arch-Guns with Arch-Melee and Archwing suits, so we
 * inspect the raw WFCD category for that case. */
export function isRivenEligible(
  category: BrowseCategory,
  item: { category?: string },
): boolean {
  if (RIVEN_ELIGIBLE_CATEGORIES.has(category)) return true
  if (category === "archwing" && item.category === "Arch-Gun") return true
  return false
}

/** Returns the stat list appropriate to the item's category. */
export function getRivenStatsFor(category: BrowseCategory): readonly string[] {
  return category === "melee" ? MELEE_RIVEN_STATS : GUN_RIVEN_STATS
}

export function createSyntheticRiven(): Mod {
  return {
    uniqueName: RIVEN_UNIQUE_NAME,
    name: "Riven Mod",
    imageName: RIVEN_IMAGE_NAME,
    polarity: "madurai",
    rarity: "Riven",
    baseDrain: 0,
    fusionLimit: 8,
    type: "Riven",
    tradable: false,
  }
}

export function isRivenMod(mod: { uniqueName: string }): boolean {
  return mod.uniqueName === RIVEN_UNIQUE_NAME
}
