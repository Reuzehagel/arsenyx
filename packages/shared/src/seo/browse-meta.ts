// `/browse` head meta, shared by apps/web routes/_app/browse.tsx and the edge
// Worker.

import { getCategoryLabel, isValidCategory } from "../warframe/categories"
import type { BrowseCategory } from "../warframe/types"

export type BrowseFilter = BrowseCategory | "all"

/** `/browse?category=` coercion: "all" is a valid pseudo-category; anything
 *  else unknown collapses to "warframes". */
export function coerceBrowseCategory(raw: unknown): BrowseFilter {
  if (raw === "all") return "all"
  return typeof raw === "string" && isValidCategory(raw) ? raw : "warframes"
}

/** Head meta for a `/browse` category view. Filtered/sorted/search variants
 *  collapse onto the category canonical. */
export function browseMeta(category: BrowseFilter): {
  title: string
  description: string
  canonicalPath: string
} {
  const label = category === "all" ? "All Items" : getCategoryLabel(category)
  const noun =
    category === "all" ? "item" : label.replace(/s$/, "").toLowerCase()
  return {
    title: `Browse ${label}`,
    description: `Browse every ${noun} in Warframe and jump into a build with mods, arcanes, and stats.`,
    canonicalPath: `/browse?category=${category}`,
  }
}
