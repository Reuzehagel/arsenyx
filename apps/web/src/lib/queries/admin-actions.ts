import type {
  AdminBuildsResponse,
  AdminOrgsResponse,
  AdminStats,
  AdminUserFlag,
  AdminUsersResponse,
} from "@arsenyx/shared/api/admin"
import type { BuildVisibility } from "@arsenyx/shared/api/build-dto"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import {
  apiCall,
  type ApiFetchInit,
  toQueryString,
} from "@/lib/util/api-client"

import { buildKeys } from "./build-query"
import { orgKeys } from "./org-query"

type AdminListParams = { page: number; q: string; category?: string }

const adminKeys = {
  users: ["admin", "users"] as const,
  builds: ["admin", "builds"] as const,
  orgs: ["admin", "orgs"] as const,
  stats: ["admin", "stats"] as const,
}

/** The admin panel shows the server's message verbatim. */
const adminCall = <T = unknown>(path: string, init: ApiFetchInit = {}) =>
  apiCall<T>(path, { ...init, serverMessage: true })

const listQuery = (p: AdminListParams) =>
  toQueryString({ page: p.page, q: p.q, category: p.category }, { page: 1 })

// ---------------- Users

export const adminUsersQuery = (params: { page: number; q: string }) =>
  queryOptions({
    queryKey: [...adminKeys.users, params],
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
      qc.invalidateQueries({ queryKey: adminKeys.users })
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
      qc.invalidateQueries({ queryKey: adminKeys.users })
      qc.invalidateQueries({ queryKey: adminKeys.stats })
    },
  })
}

// ---------------- Builds (admin view)

export const adminBuildsQuery = (params: AdminListParams) =>
  queryOptions({
    queryKey: [...adminKeys.builds, params],
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
      qc.invalidateQueries({ queryKey: adminKeys.builds })
      qc.invalidateQueries({ queryKey: adminKeys.stats })
      qc.invalidateQueries({ queryKey: buildKeys.lists })
    },
  })
}

export function useAdminSetBuildVisibility(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (visibility: BuildVisibility) =>
      adminCall(`/admin/builds/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        json: { visibility },
      }),
    onSuccess: () => {
      // The viewer reads this build under buildKeys.detail; refresh it so the
      // header visibility badge tracks the change without a manual reload.
      qc.invalidateQueries({ queryKey: buildKeys.detail(slug) })
      qc.invalidateQueries({ queryKey: adminKeys.builds })
      qc.invalidateQueries({ queryKey: buildKeys.lists })
    },
  })
}

// ---------------- Orgs

export const adminOrgsQuery = (params: { page: number; q: string }) =>
  queryOptions({
    queryKey: [...adminKeys.orgs, params],
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
      await qc.cancelQueries({ queryKey: adminKeys.orgs })
      const snapshots = qc.getQueriesData<AdminOrgsResponse>({
        queryKey: adminKeys.orgs,
      })
      qc.setQueriesData<AdminOrgsResponse>(
        { queryKey: adminKeys.orgs },
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
    // Confirm the admin list from the PATCH response rather than refetching:
    // the mutation response is authoritative, so a refetch would just spend a
    // round trip (and a flicker) to learn what we were already told.
    //
    // This originally also worked around Hyperdrive serving pre-write reads for
    // ~60s. That's now disabled on the Hyperdrive config (see
    // apps/api/wrangler.toml), but confirming from the response is the better
    // pattern regardless, so it stays.
    onSuccess: (data, input) => {
      qc.setQueriesData<AdminOrgsResponse>(
        { queryKey: adminKeys.orgs },
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
      // Verified drives the purple-vs-muted org rendering on the org page, the
      // directory, and build cards — refresh them all. These carried
      // refetchType "none" while Hyperdrive's query cache could serve a
      // pre-write row into an eager refetch; with caching disabled there's no
      // stale window to dodge, so a plain invalidate is correct and also
      // updates any of these that happen to be mounted.
      qc.invalidateQueries({ queryKey: orgKeys.detail(input.slug) })
      qc.invalidateQueries({ queryKey: orgKeys.all })
      qc.invalidateQueries({ queryKey: buildKeys.lists })
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
      qc.invalidateQueries({ queryKey: adminKeys.orgs })
      qc.invalidateQueries({ queryKey: adminKeys.stats })
    },
  })
}

// ---------------- Stats

export const adminStatsQuery = () =>
  queryOptions({
    queryKey: adminKeys.stats,
    queryFn: () => adminCall<AdminStats>(`/admin/stats`),
  })
