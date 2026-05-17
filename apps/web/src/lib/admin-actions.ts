import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import {
  apiErrorMessage,
  apiFetch,
  ApiError,
  type ApiFetchInit,
} from "@/lib/api-client"

async function adminCall<T = unknown>(
  path: string,
  opts: ApiFetchInit = {},
): Promise<T> {
  try {
    return await apiFetch<T>(path, opts)
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(apiErrorMessage(err, `http_${err.status}`))
    }
    throw err
  }
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
    queryFn: () =>
      adminCall<AdminUsersResponse>(`/admin/users${listQuery(params)}`),
  })

export function useAdminPatchUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      patch: Partial<Record<AdminUserFlag, boolean>>
    }) =>
      adminCall(`/admin/users/${encodeURIComponent(input.id)}`, {
        method: "PATCH",
        json: input.patch,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}

export function useAdminDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      adminCall<void>(`/admin/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
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
    queryFn: () =>
      adminCall<AdminBuildsResponse>(`/admin/builds${listQuery(params)}`),
  })

export function useAdminDeleteBuild() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      adminCall<void>(`/admin/builds/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      }),
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
    queryFn: () =>
      adminCall<AdminOrgsResponse>(`/admin/orgs${listQuery(params)}`),
  })

export function useAdminDeleteOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      adminCall<void>(`/admin/orgs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      }),
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
    queryFn: () => adminCall<AdminStats>(`/admin/stats`),
  })
