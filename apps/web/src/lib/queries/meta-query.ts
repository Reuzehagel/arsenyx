import { queryOptions } from "@tanstack/react-query"

export interface DataMeta {
  generatedAt: string
  wfcdPackageVersion: string
  gameUpdate: string | null
  itemCount: number
  modCount: number
  arcaneCount: number
}

export const metaQuery = queryOptions({
  queryKey: ["data-meta"],
  queryFn: async (): Promise<DataMeta> => {
    const r = await fetch("/data/meta.json")
    if (!r.ok) throw new Error("failed to load data meta")
    return r.json()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})
