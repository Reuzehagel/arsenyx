import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { OrgProfile, OrgRole } from "@/lib/queries/org-query"
import { apiErrorMessage, apiFetch } from "@/lib/util/api-client"

type CreateOrgInput = {
  name: string
  slug: string
  description?: string | null
  image?: string | null
}

type CreateOrgResponse = { id: string; slug: string }

const orgError = (err: unknown) => apiErrorMessage(err, "http_unknown")

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateOrgInput): Promise<CreateOrgResponse> => {
      try {
        return await apiFetch<CreateOrgResponse>(`/orgs`, {
          method: "POST",
          json: input,
        })
      } catch (err) {
        throw new Error(orgError(err), { cause: err })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", "mine"] })
    },
  })
}

type UpdateOrgInput = Partial<{
  name: string
  slug: string
  description: string | null
  image: string | null
}>

export function useUpdateOrg(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateOrgInput): Promise<CreateOrgResponse> => {
      try {
        return await apiFetch<CreateOrgResponse>(
          `/orgs/${encodeURIComponent(slug)}`,
          { method: "PATCH", json: input },
        )
      } catch (err) {
        throw new Error(orgError(err), { cause: err })
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["org", slug.toLowerCase()] })
      if (data.slug.toLowerCase() !== slug.toLowerCase()) {
        qc.invalidateQueries({ queryKey: ["org", data.slug.toLowerCase()] })
      }
      qc.invalidateQueries({ queryKey: ["orgs", "mine"] })
    },
  })
}

export function useDeleteOrg(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        await apiFetch<void>(`/orgs/${encodeURIComponent(slug)}`, {
          method: "DELETE",
        })
      } catch (err) {
        throw new Error(orgError(err), { cause: err })
      }
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["org", slug.toLowerCase()] })
      qc.invalidateQueries({ queryKey: ["orgs", "mine"] })
      qc.invalidateQueries({ queryKey: ["builds"] })
    },
  })
}

export function useAddOrgMember(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (username: string): Promise<void> => {
      try {
        await apiFetch<void>(`/orgs/${encodeURIComponent(slug)}/members`, {
          method: "POST",
          json: { username },
        })
      } catch (err) {
        throw new Error(orgError(err), { cause: err })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", slug.toLowerCase()] })
    },
  })
}

export function useUpdateOrgMemberRole(slug: string) {
  const qc = useQueryClient()
  const key = ["org", slug.toLowerCase()]
  return useMutation({
    mutationFn: async (input: {
      userId: string
      role: OrgRole
    }): Promise<void> => {
      try {
        await apiFetch<void>(
          `/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(input.userId)}`,
          { method: "PATCH", json: { role: input.role } },
        )
      } catch (err) {
        throw new Error(orgError(err), { cause: err })
      }
    },
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
    mutationFn: async (userId: string): Promise<void> => {
      try {
        await apiFetch<void>(
          `/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`,
          { method: "DELETE" },
        )
      } catch (err) {
        throw new Error(orgError(err), { cause: err })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", slug.toLowerCase()] })
      qc.invalidateQueries({ queryKey: ["orgs", "mine"] })
    },
  })
}
