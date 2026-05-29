import type { Arcane } from "@arsenyx/shared/warframe/types"

import { staticDataQuery } from "./static-data-query"

export const arcanesQuery = staticDataQuery<Arcane[]>(
  ["arcanes-all"],
  "/data/arcanes-all.json",
  "failed to load arcanes",
)
