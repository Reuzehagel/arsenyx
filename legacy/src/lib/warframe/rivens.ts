import type { BrowseCategory, Mod } from "./types"

export const RIVEN_UNIQUE_NAME = "/riven"
export const RIVEN_IMAGE_NAME = "rifle-riven-mod-e05c5519f1.png"

export const RIVEN_STATS = [
  "Puncture",
  "Critical Chance",
  "Critical Damage",
  "Electricity",
  "Heat",
  "Fire Rate",
  "Cold",
  "Impact",
  "Status Duration",
  "Slash",
  "Status Chance",
  "Toxin",
  "Ammo Maximum",
  "Magazine Capacity",
  "Damage",
  "Multishot",
  "Projectile Speed",
  "Punch Through",
  "Weapon Recoil",
  "Reload Speed",
  "Damage to Corpus",
  "Damage to Grineer",
  "Damage to Infested",
  "Zoom",
  // Melee-specific stats
  "Attack Speed",
  "Range",
  "Combo Duration",
  "Finisher Damage",
  "Channeling Damage",
  "Channeling Efficiency",
  "Slide Attack",
] as const

export const RIVEN_ELIGIBLE_CATEGORIES = new Set<BrowseCategory>([
  "primary",
  "secondary",
  "melee",
  "archwing",
  "companion-weapons",
])

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
