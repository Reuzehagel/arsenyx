import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { apiFetch, remapApiError } from "@/lib/util/api-client"

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
        throw remapApiError(err, {
          401: "unauthorized",
          403: "forbidden",
          default: "failed_link",
        })
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
    // No onSettled invalidate: Hyperdrive serves ~60s-stale reads after a
    // write, so an immediate refetch returns the pre-write list and wipes the
    // optimistic entry. The optimistic cache IS the confirmed state (rolled
    // back in onError). Same applies to reorder/unlink below.
  })
}

export function useReorderPartners(ownerSlug: string) {
  const qc = useQueryClient()
  const key = ["build", ownerSlug, "partners"] as const
  return useMutation({
    // `next` is the fully-reordered partner list; we send just the ids.
    mutationFn: async (next: PartnerBuild[]): Promise<void> => {
      try {
        await apiFetch<void>(
          `/builds/${encodeURIComponent(ownerSlug)}/partners/order`,
          { method: "PUT", json: { order: next.map((p) => p.id) } },
        )
      } catch (err) {
        throw remapApiError(err, {
          401: "unauthorized",
          403: "forbidden",
          default: "failed_reorder",
        })
      }
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PartnerBuild[]>(key)
      qc.setQueryData<PartnerBuild[]>(key, next)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
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
  })
}
