import {
  CATALOG_FILES,
  catalogUrl,
} from "@arsenyx/shared/warframe/catalog-files"

import { staticDataQuery } from "./static-data-query"

/** Kitgun component (grip/loader) name → thumbnail URL, resolved at build
 *  time from the DE manifest (see scripts/build-items-index.ts). */
export const kitgunImagesQuery = staticDataQuery<Record<string, string>>(
  catalogUrl(CATALOG_FILES.kitgunImages),
  "failed to load kitgun images",
)
