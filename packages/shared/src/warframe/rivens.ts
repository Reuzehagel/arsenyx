import type { BrowseCategory, Mod, Polarity } from "./types"

export const RIVEN_UNIQUE_NAME = "/riven"
// Rivens are excluded from the catalog (no per-mod image in the pipeline), so
// this is a bundled local icon under apps/web/public/ — DE's generic riven card
// art (`OmegaMod.png`). A local `/img/` path is what `getImageUrl` trusts; the
// old bare `"OmegaMod.png"` resolved to nothing and rendered the `?` placeholder.
export const RIVEN_IMAGE_NAME = "/img/items/riven-mod.png"

/** Polarities a riven mod can be rolled with. */
export const RIVEN_POLARITIES: readonly Polarity[] = [
  "madurai",
  "naramon",
  "vazarin",
] as const

/** Maximum base drain a riven mod can have (un-installed cost). */
export const RIVEN_MAX_DRAIN = 18
export const RIVEN_MIN_DRAIN = 0
/** What a max-rank riven costs in-game. */
export const RIVEN_DEFAULT_DRAIN = 18

/** Traits created through Riven Splicing on ranged Rivens. */
const RANGED_SPLICED_RIVEN_STATS = [
  "Weakpoint Damage",
  "Weakpoint Critical Chance",
  "Ammo Efficiency",
  "Magazine Reload While Holstered",
  "Status Damage",
] as const

/** Traits created through Riven Splicing on melee Rivens. */
const MELEE_SPLICED_RIVEN_STATS = [
  "Heavy Attack Damage",
  "Heavy Attack Windup Speed",
  "Parry Angle",
  "Slam Damage",
  "Status Damage",
] as const

/** Traits created through Riven Splicing on all Riven classes. */
const UNIVERSAL_SPLICED_RIVEN_STATS = [
  "Gas Damage",
  "Corrosive Damage",
  "Viral Damage",
  "Radiation Damage",
  "Blast Damage",
  "Magnetic Damage",
  "Damage vs Orokin",
  "Damage vs Techrot",
  "Damage vs Scaldra",
] as const

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
  ...RANGED_SPLICED_RIVEN_STATS,
  ...UNIVERSAL_SPLICED_RIVEN_STATS,
] as const

/** Stats available on melee rivens (per https://wiki.warframe.com/w/Riven_Mods).
 * Channeling was removed in the Melee 3.0 rework and replaced by the
 * heavy-attack/combo stats below — do not re-add "Channeling Damage" or
 * "Channeling Efficiency" (old saved builds keep parsing via back-compat
 * aliases in the stat parser). */
export const MELEE_RIVEN_STATS = [
  "Critical Chance",
  "Critical Damage",
  "Critical Chance for Slide Attack",
  "Damage",
  "Attack Speed",
  "Range",
  "Combo Duration",
  "Initial Combo",
  "Heavy Attack Efficiency",
  "Chance to Gain Combo Count",
  "Finisher Damage",
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
  ...MELEE_SPLICED_RIVEN_STATS,
  ...UNIVERSAL_SPLICED_RIVEN_STATS,
] as const

/** Riven stats that roll as flat additions rather than percentages, keyed to
 *  the unit suffix the in-game card prints (per
 *  https://wiki.warframe.com/w/Riven_Mods: Range/Punch Through in metres,
 *  Combo Duration in seconds, Initial Combo as a raw count). Matches how
 *  the equivalent regular mods read ("+0.7 Punch Through", "+7.5s Combo
 *  Duration"). Every other riven stat is a percentage. */
export const RIVEN_FLAT_STAT_UNITS: Readonly<Record<string, string>> = {
  Range: "",
  "Punch Through": "",
  "Combo Duration": "s",
  "Initial Combo": "",
}

export function isFlatRivenStat(stat: string): boolean {
  return Object.hasOwn(RIVEN_FLAT_STAT_UNITS, stat)
}

export const RIVEN_ELIGIBLE_CATEGORIES = new Set<BrowseCategory>([
  "primary",
  "secondary",
  "melee",
  "companion-weapons",
])

/** Riven-eligible weapons per the wiki (https://wiki.warframe.com/w/Riven_Mod):
 * Primary, Secondary, Melee, Arch-Guns, and Robotic (Sentinel/MOA/Hound)
 * weapons. Beast companion weapons (Kavat/Kubrow/Vulpaphyla/Predasite claws,
 * displayClass "Claws (Beast)") are NOT eligible — they share the
 * `companion-weapons` browse bucket with the robotic weapons that are. The
 * `archwing` browse bucket lumps Arch-Guns with Arch-Melee and suits, so we
 * gate on displayClass there too (only "Archgun" is eligible). */
export function isRivenEligible(
  category: BrowseCategory,
  item: { displayClass?: string },
): boolean {
  if (RIVEN_ELIGIBLE_CATEGORIES.has(category)) {
    return item.displayClass !== "Claws (Beast)"
  }
  if (category === "archwing" && item.displayClass === "Archgun") return true
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
    baseDrain: RIVEN_DEFAULT_DRAIN,
    fusionLimit: 8,
    type: "Riven",
    tradable: false,
  }
}

export function isRivenMod(mod: { uniqueName: string }): boolean {
  return mod.uniqueName === RIVEN_UNIQUE_NAME
}
