import { queryOptions } from "@tanstack/react-query"

export interface HelminthAbility {
  uniqueName: string
  name: string
  imageName?: string
  description: string
  source: string
}

export const helminthQuery = queryOptions({
  queryKey: ["helminth-abilities"],
  queryFn: async (): Promise<HelminthAbility[]> => {
    const r = await fetch("/data/helminth-abilities.json")
    if (!r.ok) throw new Error("failed to load helminth abilities")
    return r.json()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})
