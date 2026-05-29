import { queryOptions } from "@tanstack/react-query"

/**
 * `uniqueName → current imageName` for every catalog entity a saved build can
 * reference (items, mods, arcanes, helminth abilities). Used to re-resolve
 * build images at render time, since a build's stored `imageName` rots across
 * image-scheme changes. Tiny vs. the full catalogs (mods-all.json is ~1.2 MB),
 * so a build page can refresh every image without that download.
 */
export const imageMapQuery = queryOptions({
  queryKey: ["image-map"],
  queryFn: async (): Promise<Record<string, string>> => {
    const r = await fetch("/data/image-map.json")
    if (!r.ok) throw new Error("failed to load image map")
    return r.json()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})
