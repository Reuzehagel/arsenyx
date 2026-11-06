import {
  CATALOG_FILES,
  catalogUrl,
} from "@arsenyx/shared/warframe/catalog-files"
import type { Arcane } from "@arsenyx/shared/warframe/types"

import { staticDataQuery } from "./static-data-query"

export const arcanesQuery = staticDataQuery<Arcane[]>(
  catalogUrl(CATALOG_FILES.arcanes),
  "failed to load arcanes",
)
