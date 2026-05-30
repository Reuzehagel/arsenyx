import { staticDataQuery } from "./static-data-query"

export interface DataMeta {
  generatedAt: string
  gameUpdate: string | null
  itemCount: number
  modCount: number
  arcaneCount: number
}

export const metaQuery = staticDataQuery<DataMeta>(
  ["data-meta"],
  "/data/meta.json",
  "failed to load data meta",
)
