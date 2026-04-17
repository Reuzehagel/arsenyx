import type { BrowseCategory, Arcane } from "./types"
import { getArcanesForSlot } from "./mods"

/**
 * Get compatible arcanes for a browse category.
 * Centralizes the category-to-arcane-slot mapping used by create and build pages.
 */
export function getArcanesForCategory(category: BrowseCategory): Arcane[] {
  switch (category) {
    case "warframes":
    case "necramechs":
      return getArcanesForSlot("warframe")
    case "archwing":
      return [
        ...getArcanesForSlot("primary"),
        ...getArcanesForSlot("secondary"),
      ]
    case "primary":
      return getArcanesForSlot("primary")
    case "secondary":
      return getArcanesForSlot("secondary")
    case "melee":
      return getArcanesForSlot("melee")
    default:
      return []
  }
}
