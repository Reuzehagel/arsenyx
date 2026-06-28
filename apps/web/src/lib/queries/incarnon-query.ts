import type { IncarnonEvolution } from "@arsenyx/shared/warframe/incarnon-data"

import { staticDataQuery } from "./static-data-query"

export const incarnonEvolutionsQuery = staticDataQuery<
  Record<string, IncarnonEvolution>
>(
  ["incarnon-evolutions"],
  "/data/incarnon-evolutions.json",
  "failed to load incarnon evolutions",
)

/** Genesis adapter picker icons, keyed by base weapon name → CDN URL.
 *  Resolved from the DE manifest at build time (see build-items-index.ts);
 *  innate incarnons have no adapter and are absent. */
export const incarnonAdapterImagesQuery = staticDataQuery<
  Record<string, string>
>(
  ["incarnon-adapter-images"],
  "/data/incarnon-adapter-images.json",
  "failed to load incarnon adapter images",
)
