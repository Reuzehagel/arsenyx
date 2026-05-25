import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, ApiError } from "@/lib/util/api-client"

/** Mirrors LIST_LIMIT in apps/api/src/routes/_build-list.ts. Skeleton bone
 *  counts use this so the placeholder grid matches the loaded grid. */
export const LIST_PAGE_SIZE = 24

export type BuildListSort =
  | "newest"
  | "updated"
  | "top"
  | "bookmarked"
  | "viewed"

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

export type BuildListItem = {
  id: string
  slug: string
  name: string
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED"
  likeCount: number
  bookmarkCount: number
  viewCount: number
  hasGuide: boolean
  hasShards: boolean
  hideAuthor: boolean
  createdAt: string
  updatedAt: string
  item: {
    name: string
    imageName: string | null
    category: string
  }
  user: {
    id: string
    name: string | null
    username: string | null
    displayUsername: string | null
    image: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
    image: string | null
  } | null
}

export type BuildListResponse = {
  builds: BuildListItem[]
  total: number
  page: number
  limit: number
}

function buildQueryString(params: BuildListParams, defaultSort: BuildListSort) {
  const q = new URLSearchParams()
  if (params.page > 1) q.set("page", String(params.page))
  if (params.sort !== defaultSort) q.set("sort", params.sort)
  if (params.q) q.set("q", params.q)
  if (params.category) q.set("category", params.category)
  if (params.item) q.set("item", params.item)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.hasGuide) q.set("hasGuide", "1")
  if (params.hasShards) q.set("hasShards", "1")
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
