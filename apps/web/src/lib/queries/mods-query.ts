import type { Mod } from "@arsenyx/shared/warframe/types"

import { staticDataQuery } from "./static-data-query"

export const modsQuery = staticDataQuery<Mod[]>(
  ["mods-all"],
  "/data/mods-all.json",
  "failed to load mods",
)
