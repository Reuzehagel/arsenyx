import { useMutation, useQueryClient } from "@tanstack/react-query"

import { API_URL } from "@/lib/constants"
import type { OrgProfile, OrgRole } from "@/lib/org-query"

type CreateOrgInput = {
  name: string
  slug: string
  description?: string | null
  image?: string | null
}

type CreateOrgResponse = { id: string; slug: string }

async function readError(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: string }
    return j.error ?? `http_${r.status}`
  } catch {
    return `http_${r.status}`
  }
}

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateOrgInput): Promise<CreateOrgResponse> => {
      const r = await fetch(`${API_URL}/orgs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error(await readError(r))
      return r.json()
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
      const r = await fetch(`${API_URL}/orgs/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error(await readError(r))
      return r.json()
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
      const r = await fetch(`${API_URL}/orgs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!r.ok && r.status !== 204) throw new Error(await readError(r))
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
      const r = await fetch(
        `${API_URL}/orgs/${encodeURIComponent(slug)}/members`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        },
      )
      if (!r.ok) throw new Error(await readError(r))
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
      const r = await fetch(
        `${API_URL}/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(input.userId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: input.role }),
        },
      )
      if (!r.ok) throw new Error(await readError(r))
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
      const r = await fetch(
        `${API_URL}/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE", credentials: "include" },
      )
      if (!r.ok && r.status !== 204) throw new Error(await readError(r))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", slug.toLowerCase()] })
      qc.invalidateQueries({ queryKey: ["orgs", "mine"] })
    },
  })
}
