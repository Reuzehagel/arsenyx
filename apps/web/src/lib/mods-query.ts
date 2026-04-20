import type { Mod } from "@arsenyx/shared/warframe/types"
import { queryOptions } from "@tanstack/react-query"

export const modsQuery = queryOptions({
  queryKey: ["mods-all"],
  queryFn: async (): Promise<Mod[]> => {
    const r = await fetch("/data/mods-all.json")
    if (!r.ok) throw new Error("failed to load mods")
    return r.json()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})
