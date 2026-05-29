import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import {
  type BuildListParams,
  type BuildListResponse,
  buildQueryString,
} from "@/lib/queries/builds-list-query"
import { apiFetch, ApiError } from "@/lib/util/api-client"

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

export type OrgDirectoryItem = {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
  createdAt: string
  memberCount: number
  buildCount: number
}

export type OrgDirectoryResponse = {
  orgs: OrgDirectoryItem[]
  total: number
  page: number
  limit: number
}

export const orgsDirectoryQuery = (page: number) =>
  queryOptions({
    queryKey: ["orgs", "directory", page],
    queryFn: async (): Promise<OrgDirectoryResponse> => {
      const qs = page > 1 ? `?page=${page}` : ""
      try {
        return await apiFetch<OrgDirectoryResponse>(`/orgs/public${qs}`)
      } catch (err) {
        throw new Error("failed to load organizations", { cause: err })
      }
    },
  })

export const orgQuery = (slug: string) =>
  queryOptions({
    queryKey: ["org", slug.toLowerCase()],
    queryFn: async (): Promise<OrgProfile> => {
      try {
        return await apiFetch<OrgProfile>(`/orgs/${encodeURIComponent(slug)}`)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) throw notFound()
        throw new Error("failed to load organization", { cause: err })
      }
    },
  })

export const orgBuildsQuery = (slug: string, params: BuildListParams) =>
  queryOptions({
    queryKey: ["builds", "org", slug.toLowerCase(), params],
    queryFn: async (): Promise<BuildListResponse> => {
      const qs = buildQueryString(params, "newest", ["item", "limit"])
      try {
        return await apiFetch<BuildListResponse>(
          `/orgs/${encodeURIComponent(slug)}/builds${qs}`,
        )
      } catch (err) {
        throw new Error("failed to load builds", { cause: err })
      }
    },
  })

export const myOrgsQuery = () =>
  queryOptions({
    queryKey: ["orgs", "mine"],
    queryFn: async (): Promise<MyOrgsResponse> => {
      try {
        return await apiFetch<MyOrgsResponse>(`/orgs`)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401)
          throw new Error("unauthorized", { cause: err })
        throw new Error("failed to load organizations", { cause: err })
      }
    },
    retry: false,
  })
