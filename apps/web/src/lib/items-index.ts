import type { BrowseItem } from "@arsenyx/shared/warframe/types"

import { CATEGORIES, type ItemsIndex } from "@/lib/catalog"

export const SORT_VALUES = [
  "name-asc",
  "name-desc",
  "date-desc",
  "date-asc",
] as const
export type SortOption = (typeof SORT_VALUES)[number]

/** Every catalog item once, in category order. An item listed under several
 *  categories is kept once; the key is uniqueName + slug because modular
 *  kitgun barrels share a uniqueName across distinct Primary/Secondary forms. */
export function allItems(index: ItemsIndex): BrowseItem[] {
  const byKey = new Map<string, BrowseItem>()
  for (const { id } of CATEGORIES) {
    for (const it of index[id] ?? []) {
      const key = `${it.uniqueName}|${it.slug}`
      if (!byKey.has(key)) byKey.set(key, it)
    }
  }
  return [...byKey.values()]
}

export function sortItems(
  items: BrowseItem[],
  option: SortOption,
): BrowseItem[] {
  const sorted = [...items]
  switch (option) {
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    case "date-desc":
      return sorted.sort((a, b) =>
        (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
      )
    case "date-asc":
      return sorted.sort((a, b) =>
        (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""),
      )
  }
}
