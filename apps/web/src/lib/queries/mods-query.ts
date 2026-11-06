import {
  CATALOG_FILES,
  catalogUrl,
} from "@arsenyx/shared/warframe/catalog-files"
import type { Mod } from "@arsenyx/shared/warframe/types"

import { staticDataQuery } from "./static-data-query"

export const modsQuery = staticDataQuery<Mod[]>(
  catalogUrl(CATALOG_FILES.mods),
  "failed to load mods",
)
