import { staticDataQuery } from "./static-data-query"

/** Zaw component (grip/link/strike) name → thumbnail URL, resolved at build
 *  time from the DE manifest (see scripts/build-items-index.ts). */
export const zawImagesQuery = staticDataQuery<Record<string, string>>(
  ["zaw-images"],
  "/data/zaw-images.json",
  "failed to load zaw images",
)
