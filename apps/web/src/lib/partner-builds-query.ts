import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { apiFetch, ApiError } from "@/lib/api-client"

import type { BuildListItem } from "./builds-list-query"

export type PartnerBuild = BuildListItem

type PartnersResponse = { builds: PartnerBuild[] }

export const partnerBuildsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["build", slug, "partners"] as const,
    queryFn: async (): Promise<PartnerBuild[]> => {
      try {
        const data = await apiFetch<PartnersResponse>(
          `/builds/${encodeURIComponent(slug)}/partners`,
        )
        return data.builds
      } catch (err) {
        throw new Error("failed_load_partners", { cause: err })
      }
    },
  })

export function useBuildSearch(q: string) {
  return useQuery({
    queryKey: ["builds", "search", q] as const,
    queryFn: async (): Promise<PartnerBuild[]> => {
      try {
        const data = await apiFetch<PartnersResponse>(
          `/builds/search?q=${encodeURIComponent(q)}`,
        )
        return data.builds
      } catch (err) {
        throw new Error("failed_search", { cause: err })
      }
    },
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}

export function useLinkPartner(ownerSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (partner: PartnerBuild): Promise<void> => {
      try {
        await apiFetch<void>(
          `/builds/${encodeURIComponent(ownerSlug)}/partners/${encodeURIComponent(partner.slug)}`,
          { method: "PUT" },
        )
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) throw new Error("unauthorized")
          if (err.status === 403) throw new Error("forbidden")
          throw new Error("failed_link")
        }
        throw err
      }
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
      try {
        await apiFetch<void>(
          `/builds/${encodeURIComponent(ownerSlug)}/partners/${encodeURIComponent(partnerSlug)}`,
          { method: "DELETE" },
        )
      } catch (err) {
        throw new Error("failed_unlink", { cause: err })
      }
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
