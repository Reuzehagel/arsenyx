import { queryOptions } from "@tanstack/react-query"

import type { ItemsIndex } from "@/lib/warframe"

export const itemsIndexQuery = queryOptions({
  queryKey: ["items-index"],
  queryFn: async (): Promise<ItemsIndex> => {
    const r = await fetch("/data/items-index.json")
    if (!r.ok) throw new Error("failed to load items index")
    return r.json()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})
