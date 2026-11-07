import {
  CATALOG_FILES,
  catalogUrl,
} from "@arsenyx/shared/warframe/catalog-files"

import type { ItemsIndex } from "@/lib/catalog"

import { staticDataQuery } from "./static-data-query"

export const itemsIndexQuery = staticDataQuery<ItemsIndex>(
  catalogUrl(CATALOG_FILES.itemsIndex),
  "failed to load items index",
)
