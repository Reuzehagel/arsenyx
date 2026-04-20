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
]

// Static lookup maps built once at module init
const CATEGORY_BY_ID = new Map(BROWSE_CATEGORIES.map((c) => [c.id, c]))

const VALID_CATEGORY_IDS = new Set<string>(BROWSE_CATEGORIES.map((c) => c.id))

const WARFRAME_CATEGORIES_SET = new Set<BrowseCategory>([
  "warframes",
  "necramechs",
])
const WEAPON_CATEGORIES_SET = new Set<BrowseCategory>([
  "primary",
  "secondary",
  "melee",
])
const GUN_CATEGORIES_SET = new Set<BrowseCategory>(["primary", "secondary"])
const EXALTED_WEAPON_CATEGORIES_SET = new Set<BrowseCategory>([
  "exalted-weapons",
])
const COMPANION_WEAPON_CATEGORIES_SET = new Set<BrowseCategory>([
  "companion-weapons",
])

/**
 * Get category config by ID
 */
export function getCategoryConfig(
  categoryId: BrowseCategory,
): CategoryConfig | undefined {
  return CATEGORY_BY_ID.get(categoryId)
}

/**
 * Get category config by WFCD category name
 */
export function getCategoryByWfcd(
  wfcdCategory: string,
): CategoryConfig | undefined {
  return BROWSE_CATEGORIES.find((c) =>
    c.wfcdCategories.includes(wfcdCategory as WfcdCategory),
  )
}

/**
 * Get default category for browse page
 */
export function getDefaultCategory(): BrowseCategory {
  return "warframes"
}

/**
 * Validate if a string is a valid browse category
 */
export function isValidCategory(category: string): category is BrowseCategory {
  return VALID_CATEGORY_IDS.has(category)
}

/**
 * Map WFCD category to our browse category
 */
export function mapWfcdCategory(
  wfcdCategory: string,
  itemType?: string,
): BrowseCategory | null {
  // Special handling for Necramechs (they're in Warframes category but have specific type)
  if (wfcdCategory === "Warframes" && itemType?.includes("Mech")) {
    return "necramechs"
  }

  const config = getCategoryByWfcd(wfcdCategory)
  return config?.id ?? null
}

// =============================================================================
// CATEGORY TYPE GUARDS
// =============================================================================
// Use these helpers instead of repeating category checks throughout the codebase

/**
 * Check if a category represents a warframe or necramech
 */
export function isWarframeCategory(category: BrowseCategory): boolean {
  return WARFRAME_CATEGORIES_SET.has(category)
}

/**
 * Check if a category represents a weapon (primary, secondary, or melee)
 */
export function isWeaponCategory(category: BrowseCategory): boolean {
  return WEAPON_CATEGORIES_SET.has(category)
}

/**
 * Check if a category represents a gun (primary or secondary, not melee)
 */
export function isGunCategory(category: BrowseCategory): boolean {
  return GUN_CATEGORIES_SET.has(category)
}

/**
 * Check if a category represents a melee weapon
 */
export function isMeleeCategory(category: BrowseCategory): boolean {
  return category === "melee"
}

/**
 * Check if a category represents a companion
 */
export function isCompanionCategory(category: BrowseCategory): boolean {
  return category === "companions"
}

/**
 * Check if a category represents an exalted weapon
 */
export function isExaltedWeaponCategory(category: BrowseCategory): boolean {
  return EXALTED_WEAPON_CATEGORIES_SET.has(category)
}

/**
 * Check if a category represents a companion weapon
 */
export function isCompanionWeaponCategory(category: BrowseCategory): boolean {
  return COMPANION_WEAPON_CATEGORIES_SET.has(category)
}

/**
 * Check if a category is the archwing category
 */
export function isArchwingCategory(category: BrowseCategory): boolean {
  return category === "archwing"
}
