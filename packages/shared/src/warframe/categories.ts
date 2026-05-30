import type { BrowseCategory } from "./types"

/** The valid browse-category ids — single source of truth for `isValidCategory`. */
export const BROWSE_CATEGORY_IDS: readonly BrowseCategory[] = [
  "warframes",
  "primary",
  "secondary",
  "melee",
  "necramechs",
  "companions",
  "companion-weapons",
  "exalted-weapons",
  "archwing",
  "railjack",
]

const VALID_CATEGORY_IDS = new Set<string>(BROWSE_CATEGORY_IDS)

/**
 * Validate if a string is a valid browse category
 */
export function isValidCategory(category: string): category is BrowseCategory {
  return VALID_CATEGORY_IDS.has(category)
}
