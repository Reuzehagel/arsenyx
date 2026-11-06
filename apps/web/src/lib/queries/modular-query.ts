import {
  CATALOG_FILES,
  catalogUrl,
} from "@arsenyx/shared/warframe/catalog-files"
import type { ModularData } from "@arsenyx/shared/warframe/types"

import { staticDataQuery } from "./static-data-query"

/** Kitgun/Zaw per-combination stat tables, reconstructed at build time from
 *  the wiki's Module:Modular/data (see scripts/build/merge-modular.ts). Only
 *  the kitgun half is read (the item sidebar recomputes a chamber's stats from
 *  the selected grip + loader); zaw stats still come from the hand-kept
 *  tables in @arsenyx/shared/warframe/zaw-data, whose values and field
 *  semantics differ from the staged `zaw` half. */
export const modularQuery = staticDataQuery<ModularData>(
  catalogUrl(CATALOG_FILES.modular),
  "failed to load modular weapon data",
)
