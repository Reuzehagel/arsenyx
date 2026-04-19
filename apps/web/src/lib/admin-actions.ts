import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { API_URL } from "@/lib/constants"

async function adminFetch(
  path: string,
  opts: RequestInit = {},
): Promise<Response> {
  const r = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...opts,
  })
  if (!r.ok) {
    let msg = `http_${r.status}`
    try {
      const j = (await r.json()) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return r
}

function listQuery(params: {
  page: number
  q: string
  category?: string
}): string {
  const qs = new URLSearchParams()
  if (params.page > 1) qs.set("page", String(params.page))
  if (params.q) qs.set("q", params.q)
  if (params.category) qs.set("category", params.category)
  const s = qs.toString()
  return s ? `?${s}` : ""
}

// ---------------- Users

export type AdminUser = {
  id: string
  name: string | null
  email: string
  username: string | null
  displayUsername: string | null
  image: string | null
  createdAt: string
  isVerified: boolean
  isCommunityLeader: boolean
  isModerator: boolean
  isAdmin: boolean
  isBanned: boolean
  buildCount: number
}

export type AdminUserFlag =
  | "isVerified"
  | "isCommunityLeader"
  | "isModerator"
  | "isAdmin"
  | "isBanned"

export type AdminUsersResponse = {
  users: AdminUser[]
  total: number
  page: number
  limit: number
}

export const adminUsersQuery = (params: { page: number; q: string }) =>
  queryOptions({
    queryKey: ["admin", "users", params],
    queryFn: async (): Promise<AdminUsersResponse> => {
      const r = await adminFetch(`/admin/users${listQuery(params)}`)
      return r.json()
    },
  })

export function useAdminPatchUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      patch: Partial<Record<AdminUserFlag, boolean>>
    }) => {
      const r = await adminFetch(
        `/admin/users/${encodeURIComponent(input.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.patch),
        },
      )
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}

export function useAdminDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await adminFetch(`/admin/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] })
      qc.invalidateQueries({ queryKey: ["admin", "stats"] })
    },
  })
}

// ---------------- Builds (admin view)

export type AdminBuildRow = {
  id: string
  slug: string
  name: string
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED"
  likeCount: number
  bookmarkCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  item: { name: string; imageName: string | null; category: string }
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

export type AdminBuildsResponse = {
  builds: AdminBuildRow[]
  total: number
  page: number
  limit: number
}

export const adminBuildsQuery = (params: {
  page: number
  q: string
  category?: string
}) =>
  queryOptions({
    queryKey: ["admin", "builds", params],
    queryFn: async (): Promise<AdminBuildsResponse> => {
      const r = await adminFetch(`/admin/builds${listQuery(params)}`)
      return r.json()
    },
  })

export function useAdminDeleteBuild() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (slug: string) => {
      await adminFetch(`/admin/builds/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "builds"] })
      qc.invalidateQueries({ queryKey: ["admin", "stats"] })
      qc.invalidateQueries({ queryKey: ["builds"] })
    },
  })
}

// ---------------- Orgs

export type AdminOrg = {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
  createdAt: string
  memberCount: number
  buildCount: number
}

export type AdminOrgsResponse = {
  orgs: AdminOrg[]
  total: number
  page: number
  limit: number
}

export const adminOrgsQuery = (params: { page: number; q: string }) =>
  queryOptions({
    queryKey: ["admin", "orgs", params],
    queryFn: async (): Promise<AdminOrgsResponse> => {
      const r = await adminFetch(`/admin/orgs${listQuery(params)}`)
      return r.json()
    },
  })

export function useAdminDeleteOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (slug: string) => {
      await adminFetch(`/admin/orgs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orgs"] })
      qc.invalidateQueries({ queryKey: ["admin", "stats"] })
    },
  })
}

// ---------------- Stats

export type AdminStats = {
  userCount: number
  orgCount: number
  buildCount: number
  buildsDay: number
  buildsWeek: number
  buildsMonth: number
  buildsByCategory: Array<{ category: string; count: number }>
}

export const adminStatsQuery = () =>
  queryOptions({
    queryKey: ["admin", "stats"],
    queryFn: async (): Promise<AdminStats> => {
      const r = await adminFetch(`/admin/stats`)
      return r.json()
    },
  })
