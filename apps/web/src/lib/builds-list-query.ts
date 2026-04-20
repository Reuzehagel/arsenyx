import { queryOptions } from "@tanstack/react-query"

import { API_URL } from "@/lib/constants"

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
  if (params.hasGuide) q.set("hasGuide", "1")
  if (params.hasShards) q.set("hasShards", "1")
  const str = q.toString()
  return str ? `?${str}` : ""
}

export const publicBuildsQuery = (params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "public", params],
    queryFn: async (): Promise<BuildListResponse> => {
      const r = await fetch(
        `${API_URL}/builds${buildQueryString(params, "newest")}`,
        { credentials: "include" },
      )
      if (!r.ok) throw new Error("failed to load builds")
      return r.json()
    },
  })

export const myBuildsQuery = (params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "mine", params],
    queryFn: async (): Promise<BuildListResponse> => {
      const r = await fetch(
        `${API_URL}/builds/mine${buildQueryString(params, "updated")}`,
        { credentials: "include" },
      )
      if (r.status === 401) throw new Error("unauthorized")
      if (!r.ok) throw new Error("failed to load builds")
      return r.json()
    },
    retry: false,
  })

export const bookmarkedBuildsQuery = (params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "bookmarks", params],
    queryFn: async (): Promise<BuildListResponse> => {
      const r = await fetch(
        `${API_URL}/builds/bookmarks${buildQueryString(params, "newest")}`,
        { credentials: "include" },
      )
      if (r.status === 401) throw new Error("unauthorized")
      if (!r.ok) throw new Error("failed to load builds")
      return r.json()
    },
    retry: false,
  })
