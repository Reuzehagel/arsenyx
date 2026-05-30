import type { ModularData } from "@arsenyx/shared/warframe/types"

import { staticDataQuery } from "./static-data-query"

/** Kitgun/Zaw per-combination stat tables, reconstructed at build time from
 *  the wiki's Module:Modular/data (see scripts/build/merge-modular.ts). Used
 *  by the build editor to recompute a kitgun chamber's stats from the selected
 *  grip + loader. */
export const modularQuery = staticDataQuery<ModularData>(
  ["modular"],
  "/data/modular.json",
  "failed to load modular weapon data",
)
