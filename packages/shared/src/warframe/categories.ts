import type { BrowseCategory } from "./types"

/**
 * Display labels for every browse category — THE single source of truth for the
 * category set. Typed as a *total* `Record` so adding a `BrowseCategory` fails
 * to compile until it has a label; the id list, the validity check, and (in
 * web) the tab order all derive from these keys, so they can't drift.
 */
export const CATEGORY_LABELS: Record<BrowseCategory, string> = {
  warframes: "Warframes",
  primary: "Primary",
  secondary: "Secondary",
  melee: "Melee",
  necramechs: "Necramechs",
  companions: "Companions",
  "companion-weapons": "Companion Weapons",
  "exalted-weapons": "Exalted",
  archwing: "Archwing",
  railjack: "Railjack",
}

/** The valid browse-category ids in canonical order — derived from
 *  `CATEGORY_LABELS` keys so it can't drift from the label set. */
export const BROWSE_CATEGORY_IDS: readonly BrowseCategory[] = Object.keys(
  CATEGORY_LABELS,
) as BrowseCategory[]

const VALID_CATEGORY_IDS = new Set<string>(BROWSE_CATEGORY_IDS)

/**
 * Validate if a string is a valid browse category. Backed by a `Set`, so only
 * the real category ids match — prototype keys (`constructor`, `toString`, …)
 * are correctly rejected.
 */
export function isValidCategory(category: string): category is BrowseCategory {
  return VALID_CATEGORY_IDS.has(category)
}

/** Human label for a category id; echoes the raw value for unknown ids.
 *  Guarded by `isValidCategory` (not a bare index) so `Object.prototype` keys
 *  like `"constructor"` don't resolve to an inherited member. */
export function getCategoryLabel(category: string): string {
  return isValidCategory(category) ? CATEGORY_LABELS[category] : category
}
