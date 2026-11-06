import type { BuildListResponse } from "@arsenyx/shared/api/build-dto"
import type {
  MyOrgsResponse,
  OrgDirectoryResponse,
  OrgProfile,
  OrgRole,
} from "@arsenyx/shared/api/orgs"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import {
  apiCall,
  type ApiErrorPolicy,
  type ApiFetchInit,
} from "@/lib/util/api-client"
import { directoryQueryString } from "@/lib/util/directory-search"

import { buildKeys } from "./build-query"
import { type BuildListParams, listQueryString } from "./builds-list-query"

/** Org slugs are case-insensitive, so keys lowercase them: every caller hits
 *  one cache entry whatever casing the URL used. */
export const orgKeys = {
  all: ["orgs"] as const,
  directory: (page: number, q?: string) =>
    ["orgs", "directory", page, q ?? ""] as const,
  mine: ["orgs", "mine"] as const,
  detail: (slug: string) => ["org", slug.toLowerCase()] as const,
}

const orgPath = (slug: string) => `/orgs/${encodeURIComponent(slug)}`

export const orgsDirectoryQuery = (page: number, q?: string) =>
  queryOptions({
    queryKey: orgKeys.directory(page, q),
    queryFn: () =>
      apiCall<OrgDirectoryResponse>(
        `/orgs/public${directoryQueryString(page, q)}`,
        { codes: { default: "failed to load organizations" } },
      ),
  })

export const orgQuery = (slug: string) =>
  queryOptions({
    queryKey: orgKeys.detail(slug),
    queryFn: () =>
      apiCall<OrgProfile>(orgPath(slug), {
        notFoundOn404: true,
        codes: { default: "failed to load organization" },
      }),
  })

export const orgBuildsQuery = (slug: string, params: BuildListParams) =>
  queryOptions({
    queryKey: buildKeys.orgList(slug, params),
    queryFn: () =>
      apiCall<BuildListResponse>(
        `${orgPath(slug)}/builds${listQueryString(params, "org")}`,
        { codes: { default: "failed to load builds" } },
      ),
  })

export const myOrgsQuery = () =>
  queryOptions({
    queryKey: orgKeys.mine,
    queryFn: () =>
      apiCall<MyOrgsResponse>(`/orgs`, {
        codes: { 401: "unauthorized", default: "failed to load organizations" },
      }),
    retry: false,
    // Memberships rarely change and org mutations invalidate orgKeys.mine,
    // so reopening the user menu shouldn't refetch every 30s.
    staleTime: 5 * 60_000,
  })

// ---------------- Mutations: the settings forms show the server's message.

const ORG_ERRORS: ApiErrorPolicy = {
  serverMessage: true,
  codes: { default: "http_unknown" },
}

const orgCall = <T = void>(path: string, init: ApiFetchInit) =>
  apiCall<T>(path, { ...init, ...ORG_ERRORS })

type OrgWriteInput = {
  name: string
  slug: string
  description?: string | null
  image?: string | null
}

type OrgWriteResponse = { id: string; slug: string }

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OrgWriteInput) =>
      orgCall<OrgWriteResponse>(`/orgs`, { method: "POST", json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.mine })
    },
  })
}

export function useUpdateOrg(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<OrgWriteInput>) =>
      orgCall<OrgWriteResponse>(orgPath(slug), {
        method: "PATCH",
        json: input,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: orgKeys.detail(slug) })
      if (data.slug.toLowerCase() !== slug.toLowerCase()) {
        qc.invalidateQueries({ queryKey: orgKeys.detail(data.slug) })
      }
      qc.invalidateQueries({ queryKey: orgKeys.mine })
    },
  })
}

export function useDeleteOrg(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => orgCall(orgPath(slug), { method: "DELETE" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: orgKeys.detail(slug) })
      qc.invalidateQueries({ queryKey: orgKeys.mine })
      qc.invalidateQueries({ queryKey: buildKeys.lists })
    },
  })
}

export function useAddOrgMember(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (username: string) =>
      orgCall(`${orgPath(slug)}/members`, {
        method: "POST",
        json: { username },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.detail(slug) })
    },
  })
}

const memberPath = (slug: string, userId: string) =>
  `${orgPath(slug)}/members/${encodeURIComponent(userId)}`

export function useUpdateOrgMemberRole(slug: string) {
  const qc = useQueryClient()
  const key = orgKeys.detail(slug)
  return useMutation({
    mutationFn: (input: { userId: string; role: OrgRole }) =>
      orgCall(memberPath(slug, input.userId), {
        method: "PATCH",
        json: { role: input.role },
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<OrgProfile>(key)
      if (prev) {
        qc.setQueryData<OrgProfile>(key, {
          ...prev,
          members: prev.members.map((m) =>
            m.user.id === input.userId ? { ...m, role: input.role } : m,
          ),
        })
      }
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useRemoveOrgMember(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      orgCall(memberPath(slug, userId), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.detail(slug) })
      qc.invalidateQueries({ queryKey: orgKeys.mine })
    },
  })
}
