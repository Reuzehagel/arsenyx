import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import type {
  BuildListParams,
  BuildListResponse,
} from "@/lib/builds-list-query"
import { API_URL } from "@/lib/constants"

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
      const r = await fetch(
        `${API_URL}/users/${encodeURIComponent(username)}`,
        { credentials: "include" },
      )
      if (r.status === 404) throw notFound()
      if (!r.ok) throw new Error("failed to load profile")
      return r.json()
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
      const r = await fetch(
        `${API_URL}/users/${encodeURIComponent(username)}/builds${qs}`,
        { credentials: "include" },
      )
      if (!r.ok) throw new Error("failed to load builds")
      return r.json()
    },
  })
