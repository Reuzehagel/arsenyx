import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import {
  type BuildListParams,
  type BuildListResponse,
} from "@/lib/builds-list-query"
import { API_URL } from "@/lib/constants"

export type OrgRole = "ADMIN" | "MEMBER"

export type OrgMember = {
  role: OrgRole
  joinedAt: string
  user: {
    id: string
    name: string | null
    username: string | null
    displayUsername: string | null
    image: string | null
  }
}

export type OrgProfile = {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
  createdAt: string
  members: OrgMember[]
  buildCount: number
  viewer: {
    role: OrgRole | null
    isAdmin: boolean
  }
}

export type OrgSummary = {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
}

export type MyOrgsResponse = {
  memberships: Array<{
    role: OrgRole
    organization: OrgSummary
  }>
}

export const orgQuery = (slug: string) =>
  queryOptions({
    queryKey: ["org", slug.toLowerCase()],
    queryFn: async (): Promise<OrgProfile> => {
      const r = await fetch(`${API_URL}/orgs/${encodeURIComponent(slug)}`, {
        credentials: "include",
      })
      if (r.status === 404) throw notFound()
      if (!r.ok) throw new Error("failed to load organization")
      return r.json()
    },
  })

export const orgBuildsQuery = (slug: string, params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "org", slug.toLowerCase(), params],
    queryFn: async (): Promise<BuildListResponse> => {
      const q = new URLSearchParams()
      if (params.page > 1) q.set("page", String(params.page))
      if (params.sort !== "newest") q.set("sort", params.sort)
      if (params.q) q.set("q", params.q)
      if (params.category) q.set("category", params.category)
      if (params.hasGuide) q.set("hasGuide", "1")
      if (params.hasShards) q.set("hasShards", "1")
      const qs = q.toString() ? `?${q.toString()}` : ""
      const r = await fetch(
        `${API_URL}/orgs/${encodeURIComponent(slug)}/builds${qs}`,
        { credentials: "include" },
      )
      if (!r.ok) throw new Error("failed to load builds")
      return r.json()
    },
  })

export const myOrgsQuery = () =>
  queryOptions({
    queryKey: ["orgs", "mine"],
    queryFn: async (): Promise<MyOrgsResponse> => {
      const r = await fetch(`${API_URL}/orgs`, { credentials: "include" })
      if (r.status === 401) throw new Error("unauthorized")
      if (!r.ok) throw new Error("failed to load organizations")
      return r.json()
    },
    retry: false,
  })
