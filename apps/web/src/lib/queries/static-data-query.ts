import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { versionedDataUrl } from "@/lib/html-head"

/**
 * Query options for a file served from `apps/web/public/data/`. These are
 * precomputed at build time and never change at runtime, so every query
 * caches forever. The key is the path, so one file is one cache entry.
 */
export function staticDataQuery<T>(
  path: string,
  errMsg: string,
  options?: { notFoundOn404?: boolean },
) {
  // Stamped with the build's data version. index.html preloads
  // items-index.json via the same versionedDataUrl, so the preload is reused.
  const url = versionedDataUrl(path, __DATA_VERSION__)
  return queryOptions({
    queryKey: ["data", path],
    queryFn: async (): Promise<T> => {
      const r = await fetch(url)
      if (options?.notFoundOn404 && r.status === 404) throw notFound()
      if (!r.ok) throw new Error(errMsg)
      return r.json()
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
