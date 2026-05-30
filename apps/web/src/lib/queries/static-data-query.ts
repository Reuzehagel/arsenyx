import { type QueryKey, queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

/**
 * Factory for the static-data queries served from `apps/web/public/data/`.
 * These files are precomputed at build time and never change at runtime, so
 * every query caches forever (`staleTime`/`gcTime: Infinity`).
 *
 * Each request carries a `?v=<data-version>` stamp (baked in at build time —
 * see vite.config.ts) so the CDN can serve `/data/*` as `immutable` while a
 * data-pipeline regeneration cleanly busts the cache via a fresh URL.
 */
export function staticDataQuery<T>(
  queryKey: QueryKey,
  path: string,
  errMsg: string,
  options?: { notFoundOn404?: boolean },
) {
  const url = `${path}${path.includes("?") ? "&" : "?"}v=${__DATA_VERSION__}`
  return queryOptions({
    queryKey,
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
