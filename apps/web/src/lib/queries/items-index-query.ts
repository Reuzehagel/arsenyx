import type { ItemsIndex } from "@/lib/warframe"

import { staticDataQuery } from "./static-data-query"

export const itemsIndexQuery = staticDataQuery<ItemsIndex>(
  ["items-index"],
  "/data/items-index.json",
  "failed to load items index",
)
