import type { BuildListResponse } from "@arsenyx/shared/api/build-dto"
import {
  LIST_DEFAULT_SORTS,
  type ListScope,
  type ListSort,
} from "@arsenyx/shared/api/build-list"
import { queryOptions } from "@tanstack/react-query"

import { apiCall, toQueryString } from "@/lib/util/api-client"

import { buildKeys } from "./build-query"

export type BuildListParams = {
  page: number
  sort: ListSort
  q?: string
  category?: string
  item?: string
  limit?: number
  hasGuide?: boolean
  hasShards?: boolean
}

export type BuildListScope = "public" | "mine" | "bookmarks"

/** Query string for every build-list endpoint — all parse the same filters
 *  (api `parseListQuery`). Keys are listed in wire order. */
export function listQueryString(p: BuildListParams, scope: ListScope): string {
  return toQueryString(
    {
      page: p.page,
      sort: p.sort,
      q: p.q,
      category: p.category,
      item: p.item,
      limit: p.limit,
      hasGuide: p.hasGuide,
      hasShards: p.hasShards,
    },
    { page: 1, sort: LIST_DEFAULT_SORTS[scope] },
  )
}

const LIST_ENDPOINTS: Record<
  BuildListScope,
  { path: string; authRequired: boolean }
> = {
  public: { path: "/builds", authRequired: false },
  mine: { path: "/builds/mine", authRequired: true },
  bookmarks: { path: "/builds/bookmarks", authRequired: true },
}

function listQuery(scope: BuildListScope, params: BuildListParams) {
  const { path, authRequired } = LIST_ENDPOINTS[scope]
  return queryOptions({
    queryKey: buildKeys.list(scope, params),
    queryFn: () =>
      apiCall<BuildListResponse>(`${path}${listQueryString(params, scope)}`, {
        codes: {
          ...(authRequired && { 401: "unauthorized" }),
          default: "failed to load builds",
        },
      }),
    ...(authRequired && { retry: false }),
  })
}

export const publicBuildsQuery = (params: BuildListParams) =>
  listQuery("public", params)

export const myBuildsQuery = (params: BuildListParams) =>
  listQuery("mine", params)

export const bookmarkedBuildsQuery = (params: BuildListParams) =>
  listQuery("bookmarks", params)
