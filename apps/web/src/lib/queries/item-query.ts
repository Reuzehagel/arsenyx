import type { BrowseCategory, DetailItem } from "../warframe"
import { staticDataQuery } from "./static-data-query"

export const itemQuery = (category: BrowseCategory, slug: string) =>
  staticDataQuery<DetailItem>(
    ["item", category, slug],
    `/data/items/${category}/${slug}.json`,
    "failed to load item",
    { notFoundOn404: true },
  )
