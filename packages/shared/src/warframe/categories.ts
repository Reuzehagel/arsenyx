import type { BrowseCategory, WfcdCategory } from "./types"

// Category configuration for the browse page
export interface CategoryConfig {
  id: BrowseCategory
  label: string
  labelPlural: string
  wfcdCategories: WfcdCategory[]
  description: string
  iconKey: string
}

export const BROWSE_CATEGORIES: CategoryConfig[] = [
  {
    id: "warframes",
    label: "Warframe",
    labelPlural: "Warframes",
    wfcdCategories: ["Warframes"],
    description: "Tenno battle suits with unique abilities",
    iconKey: "user",
  },
  {
    id: "primary",
    label: "Primary",
    labelPlural: "Primary Weapons",
    wfcdCategories: ["Primary"],
    description: "Rifles, shotguns, bows, and launchers",
    iconKey: "crosshair",
  },
  {
    id: "secondary",
    label: "Secondary",
    labelPlural: "Secondary Weapons",
    wfcdCategories: ["Secondary"],
    description: "Pistols, thrown weapons, and sidearms",
    iconKey: "target",
  },
  {
    id: "melee",
    label: "Melee",
    labelPlural: "Melee Weapons",
    wfcdCategories: ["Melee"],
    description: "Swords, polearms, and other close-combat weapons",
    iconKey: "swords",
  },
  {
    id: "necramechs",
    label: "Necramech",
    labelPlural: "Necramechs",
    // Necramechs are in the Warframes category with specific type
    wfcdCategories: ["Warframes"],
    description: "Ancient Entrati war machines",
    iconKey: "bot",
  },
  {
    id: "companions",
    label: "Companion",
    labelPlural: "Companions",
    wfcdCategories: ["Sentinels", "Pets"],
    description: "Sentinels, Kubrows, Kavats, and more",
    iconKey: "pawPrint",
  },
  {
    id: "companion-weapons",
    label: "Companion Weapon",
    labelPlural: "Companion Weapons",
    wfcdCategories: ["Primary"], // Sentinel weapons use Primary category in WFCD
    description: "Weapons for Sentinels and other companions",
    iconKey: "zap",
  },
  {
    id: "exalted-weapons",
    label: "Exalted Weapon",
    labelPlural: "Exalted Weapons",
    wfcdCategories: ["Melee"], // Exalted weapons are in Misc but we filter by type
    description: "Weapons summoned by Warframe abilities",
    iconKey: "sparkles",
  },
  {
    id: "archwing",
    label: "Archwing",
    labelPlural: "Archwing",
    wfcdCategories: ["Archwing", "Arch-Gun", "Arch-Melee"],
    description: "Archwings and their weapons for space combat",
    iconKey: "rocket",
  },
  {
    id: "railjack",
    label: "Railjack",
    labelPlural: "Railjack",
    // Synthetic Plexus item is injected by the build script — no WFCD category
    // contributes here. Listed empty so `mapWfcdCategory` won't accidentally
    // route ship-related entries (e.g. Skins.json) into this bucket.
    wfcdCategories: [],
    description: "Plexus loadout for Railjack missions",
    iconKey: "rocket",
  },
]

const VALID_CATEGORY_IDS = new Set<string>(BROWSE_CATEGORIES.map((c) => c.id))

/**
 * Validate if a string is a valid browse category
 */
export function isValidCategory(category: string): category is BrowseCategory {
  return VALID_CATEGORY_IDS.has(category)
}
