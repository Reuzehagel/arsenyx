import { staticDataQuery } from "./static-data-query"

/**
 * `uniqueName → current imageName` for every catalog entity a saved build can
 * reference (items, mods, arcanes, helminth abilities). Used to re-resolve
 * build images at render time, since a build's stored `imageName` rots across
 * image-scheme changes. Tiny vs. the full catalogs (mods-all.json is ~1.2 MB),
 * so a build page can refresh every image without that download.
 */
export const imageMapQuery = staticDataQuery<Record<string, string>>(
  ["image-map"],
  "/data/image-map.json",
  "failed to load image map",
)
