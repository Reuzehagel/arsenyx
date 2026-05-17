import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { apiFetch, ApiError } from "@/lib/api-client"
import type {
  BuildListParams,
  BuildListResponse,
} from "@/lib/builds-list-query"

export type ProfileBadges = {
  verified: boolean
  communityLeader: boolean
  moderator: boolean
  admin: boolean
}

export type ProfileStats = {
  buildCount: number
  totalLikes: number
  totalBookmarks: number
  totalViews: number
}

export type Profile = {
  id: string
  name: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
  bio: string | null
  joinedAt: string
  badges: ProfileBadges
  stats: ProfileStats
}

export const profileQuery = (username: string) =>
  queryOptions({
    queryKey: ["profile", username.toLowerCase()],
    queryFn: async (): Promise<Profile> => {
      try {
        return await apiFetch<Profile>(
          `/users/${encodeURIComponent(username)}`,
        )
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) throw notFound()
        throw new Error("failed to load profile", { cause: err })
      }
    },
  })

export const profileBuildsQuery = (username: string, params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "profile", username.toLowerCase(), params],
    queryFn: async (): Promise<BuildListResponse> => {
      const q = new URLSearchParams()
      if (params.page > 1) q.set("page", String(params.page))
      if (params.sort !== "newest") q.set("sort", params.sort)
      if (params.q) q.set("q", params.q)
      if (params.category) q.set("category", params.category)
      const qs = q.toString() ? `?${q.toString()}` : ""
      try {
        return await apiFetch<BuildListResponse>(
          `/users/${encodeURIComponent(username)}/builds${qs}`,
        )
      } catch (err) {
        throw new Error("failed to load builds", { cause: err })
      }
    },
  })
