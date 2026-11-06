import { useQuery } from "@tanstack/react-query"

import { imageMapQuery } from "@/lib/queries/image-map-query"

/**
 * Resolve a catalog entity's CURRENT image by `uniqueName`.
 *
 * Builds persist a denormalized `imageName` captured at save time. That string
 * rots whenever the image-naming/hosting scheme changes (content-hashes →
 * canonical names → our hashed R2 URLs), so trusting it shows broken
 * placeholders for older/imported builds. `uniqueName` is DE's stable id, so we
 * look the live URL up by it and fall back to the stored value only on a miss
 * (e.g. a vaulted/removed item). Backed by the compact `image-map.json`.
 */
export function useItemImage(): (
  uniqueName: string | undefined,
  fallback?: string | null,
) => string | undefined {
  const { data } = useQuery(imageMapQuery)
  return (uniqueName, fallback) =>
    (uniqueName ? data?.[uniqueName] : undefined) ?? fallback ?? undefined
}
