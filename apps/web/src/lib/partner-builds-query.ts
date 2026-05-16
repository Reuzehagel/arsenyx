import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { API_URL } from "@/lib/constants"

import type { BuildListItem } from "./builds-list-query"

export type PartnerBuild = BuildListItem

type PartnersResponse = { builds: PartnerBuild[] }

export const partnerBuildsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["build", slug, "partners"] as const,
    queryFn: async (): Promise<PartnerBuild[]> => {
      const r = await fetch(
        `${API_URL}/builds/${encodeURIComponent(slug)}/partners`,
        { credentials: "include" },
      )
      if (!r.ok) throw new Error("failed_load_partners")
      const data = (await r.json()) as PartnersResponse
      return data.builds
    },
  })

export function useBuildSearch(q: string) {
  return useQuery({
    queryKey: ["builds", "search", q] as const,
    queryFn: async (): Promise<PartnerBuild[]> => {
      const r = await fetch(
        `${API_URL}/builds/search?q=${encodeURIComponent(q)}`,
        { credentials: "include" },
      )
      if (!r.ok) throw new Error("failed_search")
      const data = (await r.json()) as PartnersResponse
      return data.builds
    },
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}

export function useLinkPartner(ownerSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (partner: PartnerBuild): Promise<void> => {
      const r = await fetch(
        `${API_URL}/builds/${encodeURIComponent(ownerSlug)}/partners/${encodeURIComponent(partner.slug)}`,
        { method: "PUT", credentials: "include" },
      )
      if (r.status === 401) throw new Error("unauthorized")
      if (r.status === 403) throw new Error("forbidden")
      if (!r.ok && r.status !== 204) throw new Error("failed_link")
    },
    onMutate: async (partner) => {
      const key = ["build", ownerSlug, "partners"] as const
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PartnerBuild[]>(key) ?? []
      if (!prev.some((p) => p.slug === partner.slug)) {
        qc.setQueryData<PartnerBuild[]>(key, [...prev, partner])
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["build", ownerSlug, "partners"], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["build", ownerSlug, "partners"] })
    },
  })
}

export function useUnlinkPartner(ownerSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (partnerSlug: string): Promise<void> => {
      const r = await fetch(
        `${API_URL}/builds/${encodeURIComponent(ownerSlug)}/partners/${encodeURIComponent(partnerSlug)}`,
        { method: "DELETE", credentials: "include" },
      )
      if (!r.ok && r.status !== 204) throw new Error("failed_unlink")
    },
    onMutate: async (partnerSlug) => {
      const key = ["build", ownerSlug, "partners"] as const
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PartnerBuild[]>(key) ?? []
      qc.setQueryData<PartnerBuild[]>(
        key,
        prev.filter((p) => p.slug !== partnerSlug),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["build", ownerSlug, "partners"], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["build", ownerSlug, "partners"] })
    },
  })
}
