import { type QueryKey, queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

/**
 * Factory for the static-data queries served from `apps/web/public/data/`.
 * These files are precomputed at build time and never change at runtime, so
 * every query caches forever (`staleTime`/`gcTime: Infinity`).
 */
export function staticDataQuery<T>(
  queryKey: QueryKey,
  path: string,
  errMsg: string,
  options?: { notFoundOn404?: boolean },
) {
  return queryOptions({
    queryKey,
    queryFn: async (): Promise<T> => {
      const r = await fetch(path)
      if (options?.notFoundOn404 && r.status === 404) throw notFound()
      if (!r.ok) throw new Error(errMsg)
      return r.json()
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
