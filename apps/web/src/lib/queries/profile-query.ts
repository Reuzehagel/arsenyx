import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import {
  type BuildListParams,
  type BuildListResponse,
  buildQueryString,
} from "@/lib/queries/builds-list-query"
import { apiFetch, ApiError, loaderError } from "@/lib/util/api-client"

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
        return await apiFetch<Profile>(`/users/${encodeURIComponent(username)}`)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) throw notFound()
        throw loaderError(err, "failed to load profile")
      }
    },
  })

export const profileBuildsQuery = (username: string, params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "profile", username.toLowerCase(), params],
    queryFn: async (): Promise<BuildListResponse> => {
      const qs = buildQueryString(params, "newest", [
        "item",
        "limit",
        "hasGuide",
        "hasShards",
      ])
      try {
        return await apiFetch<BuildListResponse>(
          `/users/${encodeURIComponent(username)}/builds${qs}`,
        )
      } catch (err) {
        throw loaderError(err, "failed to load builds")
      }
    },
  })
