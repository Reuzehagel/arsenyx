import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import type { BrowseCategory, DetailItem } from "./warframe"

export const itemQuery = (category: BrowseCategory, slug: string) =>
  queryOptions({
    queryKey: ["item", category, slug],
    queryFn: async (): Promise<DetailItem> => {
      const r = await fetch(`/data/items/${category}/${slug}.json`)
      if (r.status === 404) throw notFound()
      if (!r.ok) throw new Error("failed to load item")
      return r.json()
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
