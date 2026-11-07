import {
  CATALOG_FILES,
  catalogUrl,
} from "@arsenyx/shared/warframe/catalog-files"

import { staticDataQuery } from "./static-data-query"

/** Zaw component (grip/link/strike) name → thumbnail URL, resolved at build
 *  time from the DE manifest (see scripts/build-items-index.ts). */
export const zawImagesQuery = staticDataQuery<Record<string, string>>(
  catalogUrl(CATALOG_FILES.zawImages),
  "failed to load zaw images",
)
