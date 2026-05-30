import { useQuery } from "@tanstack/react-query"

import { itemsIndexQuery } from "@/lib/queries/items-index-query"
import type { BrowseCategory, BrowseItem } from "@/lib/warframe"

export type RecentItem = BrowseItem & { category: BrowseCategory }

export function useRecentItems(limit = 16): RecentItem[] {
  const { data } = useQuery(itemsIndexQuery)
  if (!data) return []
  const all: RecentItem[] = []
  for (const [cat, arr] of Object.entries(data) as [
    BrowseCategory,
    BrowseItem[],
  ][]) {
    if (!arr) continue
    for (const it of arr) {
      if (it.releaseDate) all.push({ ...it, category: cat })
    }
  }
  all.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))
  return all.slice(0, limit)
}

/** True when the item's name already contains "Prime", so we don't duplicate the tag. */
export function isPrimeRedundant(name: string): boolean {
  return /\bprime\b/i.test(name)
}
