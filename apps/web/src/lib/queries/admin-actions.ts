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
} from "@/lib/util/api-client"

async function adminCall<T = unknown>(
  path: string,
  opts: ApiFetchInit = {},
): Promise<T> {
  try {
    return await apiFetch<T>(path, opts)
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(apiErrorMessage(err, `http_${err.status}`), {
        cause: err,
      })
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

export function useAdminSetBuildVisibility(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (visibility: AdminBuildRow["visibility"]) =>
      adminCall(`/admin/builds/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        json: { visibility },
      }),
    onSuccess: () => {
      // The viewer reads this build under ["build", slug]; refresh it so the
      // header visibility badge tracks the change without a manual reload.
      qc.invalidateQueries({ queryKey: ["build", slug] })
      qc.invalidateQueries({ queryKey: ["admin", "builds"] })
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
  verified: boolean
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

export function useAdminSetOrgVerified() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { slug: string; verified: boolean }) =>
      adminCall<{ id: string; slug: string; verified: boolean }>(
        `/admin/orgs/${encodeURIComponent(input.slug)}`,
        {
          method: "PATCH",
          json: { verified: input.verified },
        },
      ),
    // Flip the admin list optimistically: the PATCH + list refetch round trip
    // takes seconds on a cold Worker, and with no immediate feedback the
    // toggle reads as broken (and invites mis-clicks on other rows).
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["admin", "orgs"] })
      const snapshots = qc.getQueriesData<AdminOrgsResponse>({
        queryKey: ["admin", "orgs"],
      })
      qc.setQueriesData<AdminOrgsResponse>(
        { queryKey: ["admin", "orgs"] },
        (old) =>
          old
            ? {
                ...old,
                orgs: old.orgs.map((o) =>
                  o.slug === input.slug
                    ? { ...o, verified: input.verified }
                    : o,
                ),
              }
            : old,
      )
      return { snapshots }
    },
    onError: (_err, _input, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, data)
      }
    },
    // Deliberately NO immediate refetch of the admin list: API reads go
    // through Hyperdrive, whose query cache can serve a pre-write SELECT for
    // ~a minute — an eager refetch stomps the optimistic flip with stale data
    // and the toggle visibly reverts. The PATCH response is authoritative, so
    // confirm the cache from it instead.
    onSuccess: (data, input) => {
      qc.setQueriesData<AdminOrgsResponse>(
        { queryKey: ["admin", "orgs"] },
        (old) =>
          old
            ? {
                ...old,
                orgs: old.orgs.map((o) =>
                  o.slug === input.slug ? { ...o, verified: data.verified } : o,
                ),
              }
            : old,
      )
      // Verified drives the purple-vs-muted org rendering on the org page,
      // the directory, and build cards — mark them stale so they refetch on
      // next visit (by which point the Hyperdrive cache has usually turned
      // over). refetchType "none" avoids an instant stale-read refetch for
      // anything currently mounted.
      const opts = { refetchType: "none" as const }
      qc.invalidateQueries({
        queryKey: ["org", input.slug.toLowerCase()],
        ...opts,
      })
      qc.invalidateQueries({ queryKey: ["orgs"], ...opts })
      qc.invalidateQueries({ queryKey: ["builds"], ...opts })
    },
  })
}

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
