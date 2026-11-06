import type { HelminthAbility } from "@arsenyx/shared/warframe/build-data"
import {
  CATALOG_FILES,
  catalogUrl,
} from "@arsenyx/shared/warframe/catalog-files"

import { staticDataQuery } from "./static-data-query"

export const helminthQuery = staticDataQuery<HelminthAbility[]>(
  catalogUrl(CATALOG_FILES.helminthAbilities),
  "failed to load helminth abilities",
)
