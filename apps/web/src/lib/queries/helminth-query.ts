import type { AbilityStat } from "@arsenyx/shared/warframe/types"

import { staticDataQuery } from "./static-data-query"

export interface HelminthAbility {
  uniqueName: string
  name: string
  imageName?: string
  description: string
  source: string
  stats?: AbilityStat[]
}

export const helminthQuery = staticDataQuery<HelminthAbility[]>(
  ["helminth-abilities"],
  "/data/helminth-abilities.json",
  "failed to load helminth abilities",
)
