import type { IncarnonEvolution } from "@arsenyx/shared/warframe/incarnon-data"

import { staticDataQuery } from "./static-data-query"

export const incarnonEvolutionsQuery = staticDataQuery<
  Record<string, IncarnonEvolution>
>(
  ["incarnon-evolutions"],
  "/data/incarnon-evolutions.json",
  "failed to load incarnon evolutions",
)
