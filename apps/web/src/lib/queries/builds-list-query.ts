import type {
  BuildListItemResponse,
  BuildListResponse,
} from "@arsenyx/shared/api/build-dto"
import { LIST_LIMIT, type ListSort } from "@arsenyx/shared/warframe/build-list"
import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, ApiError } from "@/lib/util/api-client"

/** Mirrors LIST_LIMIT in the api. Skeleton bone counts use this so the
 *  placeholder grid matches the loaded grid. */
export const LIST_PAGE_SIZE = LIST_LIMIT

export type BuildListSort = ListSort

/** Canonical wire shapes live in `@arsenyx/shared/api/build-dto`; re-exported
 *  under their historical names so existing consumers keep importing them
 *  here. */
export type BuildListItem = BuildListItemResponse
export type { BuildListResponse }

export type BuildListParams = {
  page: number
  sort: BuildListSort
  q?: string
  category?: string
  item?: string
  limit?: number
  hasGuide?: boolean
  hasShards?: boolean
}

/** Optional fields a caller can drop from the emitted query string. Routes
 *  that never filter by `item`/`limit` (org, profile) or by guide/shard facets
 *  (profile) pass these so their request URLs stay exactly as before. */
type OmitParam = "item" | "limit" | "hasGuide" | "hasShards"

export function buildQueryString(
  params: BuildListParams,
  defaultSort: BuildListSort,
  omit?: readonly OmitParam[],
) {
  const skip = new Set<OmitParam>(omit)
  const q = new URLSearchParams()
  if (params.page > 1) q.set("page", String(params.page))
  if (params.sort !== defaultSort) q.set("sort", params.sort)
  if (params.q) q.set("q", params.q)
  if (params.category) q.set("category", params.category)
  if (params.item && !skip.has("item")) q.set("item", params.item)
  if (params.limit && !skip.has("limit")) q.set("limit", String(params.limit))
  if (params.hasGuide && !skip.has("hasGuide")) q.set("hasGuide", "1")
  if (params.hasShards && !skip.has("hasShards")) q.set("hasShards", "1")
  const str = q.toString()
  return str ? `?${str}` : ""
}

async function loadBuilds(
  path: string,
  authRequired: boolean,
): Promise<BuildListResponse> {
  try {
    return await apiFetch<BuildListResponse>(path)
  } catch (err) {
    if (authRequired && err instanceof ApiError && err.status === 401)
      throw new Error("unauthorized", { cause: err })
    throw new Error("failed to load builds", { cause: err })
  }
}

export const publicBuildsQuery = (params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "public", params],
    queryFn: () =>
      loadBuilds(`/builds${buildQueryString(params, "newest")}`, false),
    placeholderData: keepPreviousData,
  })

export const myBuildsQuery = (params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "mine", params],
    queryFn: () =>
      loadBuilds(`/builds/mine${buildQueryString(params, "updated")}`, true),
    placeholderData: keepPreviousData,
    retry: false,
  })

export const bookmarkedBuildsQuery = (params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "bookmarks", params],
    queryFn: () =>
      loadBuilds(
        `/builds/bookmarks${buildQueryString(params, "newest")}`,
        true,
      ),
    placeholderData: keepPreviousData,
    retry: false,
  })
