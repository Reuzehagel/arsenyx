import type { BrowseItem } from "@arsenyx/shared/warframe/types"
import { useQuery } from "@tanstack/react-query"

import { allItems, sortItems } from "@/lib/items-index"
import { itemsIndexQuery } from "@/lib/queries/items-index-query"

const RECENT_COUNT = 10

/** The newest catalog items by release date. */
export function useRecentItems(): BrowseItem[] {
  const { data } = useQuery(itemsIndexQuery)
  if (!data) return []
  return sortItems(
    allItems(data).filter((it) => it.releaseDate),
    "date-desc",
  ).slice(0, RECENT_COUNT)
}
