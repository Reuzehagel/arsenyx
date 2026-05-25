import type { IncarnonEvolution } from "@arsenyx/shared/warframe/incarnon-data"
import { queryOptions } from "@tanstack/react-query"

export const incarnonEvolutionsQuery = queryOptions({
  queryKey: ["incarnon-evolutions"],
  queryFn: async (): Promise<Record<string, IncarnonEvolution>> => {
    const r = await fetch("/data/incarnon-evolutions.json")
    if (!r.ok) throw new Error("failed to load incarnon evolutions")
    return r.json()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})
