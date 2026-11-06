import type {
  BuildDetailResponse,
  PartnerBuild,
} from "@arsenyx/shared/api/build-dto"
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { apiCall } from "@/lib/util/api-client"

import { buildKeys } from "./build-query"

export type { PartnerBuild }

type PartnersResponse = { builds: PartnerBuild[] }

const partnersPath = (slug: string) =>
  `/builds/${encodeURIComponent(slug)}/partners`

/** Partner writes need the owner's session and mutual ownership. */
const writeCodes = (fallback: string) => ({
  401: "unauthorized",
  403: "forbidden",
  default: fallback,
})

export const partnerBuildsQuery = (slug: string) =>
  queryOptions({
    queryKey: buildKeys.partners(slug),
    queryFn: async (): Promise<PartnerBuild[]> =>
      (
        await apiCall<PartnersResponse>(partnersPath(slug), {
          codes: { default: "failed_load_partners" },
        })
      ).builds,
    // Seeded from the build detail payload, so don't refetch on a timer: the
    // always-mounted strip would otherwise hit /partners on every revisit and
    // refocus. Partner mutations invalidate this key, which still refetches.
    // Accepted: another user's partner edit shows only once this entry is GC'd.
    staleTime: Infinity,
  })

/**
 * Seed the partners query from the build detail payload, which already
 * carries the strip, instead of a second API request (each API cache miss pays
 * a fixed Worker CPU cost). Skipped when the payload has no partners or the
 * cache already holds a newer copy (e.g. refetched after an editor mutation).
 * Returns whether it seeded, so the caller fetches otherwise.
 */
export function seedPartnersFromBuild(
  qc: QueryClient,
  slug: string,
  build: Pick<BuildDetailResponse, "partners">,
): boolean {
  if (build.partners == null) return false
  const key = buildKeys.partners(slug)
  const buildUpdatedAt =
    qc.getQueryState(buildKeys.detail(slug))?.dataUpdatedAt ?? 0
  if ((qc.getQueryState(key)?.dataUpdatedAt ?? 0) >= buildUpdatedAt) {
    return false
  }
  qc.setQueryData(key, build.partners, { updatedAt: buildUpdatedAt })
  return true
}

/** Typeahead for the partner picker. `mine=1` scopes results to builds the
 *  requester can mutate (own + org) — linking requires mutual ownership, so
 *  anything else in the list would be un-linkable anyway. */
export function useBuildSearch(q: string) {
  return useQuery({
    queryKey: buildKeys.partnerSearch(q),
    queryFn: async (): Promise<PartnerBuild[]> =>
      (
        await apiCall<PartnersResponse>(
          `/builds/search?q=${encodeURIComponent(q)}&mine=1`,
          { codes: { default: "failed_search" } },
        )
      ).builds,
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}

export function useLinkPartner(ownerSlug: string) {
  const qc = useQueryClient()
  const key = buildKeys.partners(ownerSlug)
  return useMutation({
    meta: { errorToast: "Couldn't link the build" },
    mutationFn: (partner: PartnerBuild) =>
      apiCall<void>(
        `${partnersPath(ownerSlug)}/${encodeURIComponent(partner.slug)}`,
        { method: "PUT", codes: writeCodes("failed_link") },
      ),
    onMutate: async (partner) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PartnerBuild[]>(key) ?? []
      if (!prev.some((p) => p.slug === partner.slug)) {
        qc.setQueryData<PartnerBuild[]>(key, [...prev, partner])
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    // Reconcile against the server once the write settles, so the optimistic
    // entry is corrected if the server normalized anything (ordering, computed
    // fields) rather than being trusted as final. Same for the three partner
    // mutations below. The link is symmetric, so the partner's own strip
    // changes too.
    onSettled: (_d, _e, partner) => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: buildKeys.partners(partner.slug) })
    },
  })
}

export function useReorderPartners(ownerSlug: string) {
  const qc = useQueryClient()
  const key = buildKeys.partners(ownerSlug)
  return useMutation({
    meta: { errorToast: "Couldn't reorder linked builds" },
    // `next` is the fully-reordered partner list; we send just the ids.
    mutationFn: (next: PartnerBuild[]) =>
      apiCall<void>(`${partnersPath(ownerSlug)}/order`, {
        method: "PUT",
        json: { order: next.map((p) => p.id) },
        codes: writeCodes("failed_reorder"),
      }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PartnerBuild[]>(key)
      qc.setQueryData<PartnerBuild[]>(key, next)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useSetPartnerVariant(ownerSlug: string) {
  const qc = useQueryClient()
  const key = buildKeys.partners(ownerSlug)
  return useMutation({
    meta: { errorToast: "Couldn't change the linked variant" },
    mutationFn: (input: { partnerSlug: string; variant: number }) =>
      apiCall<void>(
        `${partnersPath(ownerSlug)}/${encodeURIComponent(input.partnerSlug)}/variant`,
        {
          method: "PUT",
          // 0 (default variant) clears the stored target server-side.
          json: { variant: input.variant || null },
          codes: writeCodes("failed_set_variant"),
        },
      ),
    onMutate: async ({ partnerSlug, variant }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PartnerBuild[]>(key)
      qc.setQueryData<PartnerBuild[]>(key, (rows) =>
        rows?.map((p) =>
          p.slug === partnerSlug ? { ...p, variant: variant || undefined } : p,
        ),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useUnlinkPartner(ownerSlug: string) {
  const qc = useQueryClient()
  const key = buildKeys.partners(ownerSlug)
  return useMutation({
    meta: { errorToast: "Couldn't unlink the build" },
    mutationFn: (partnerSlug: string) =>
      apiCall<void>(
        `${partnersPath(ownerSlug)}/${encodeURIComponent(partnerSlug)}`,
        { method: "DELETE", codes: writeCodes("failed_unlink") },
      ),
    onMutate: async (partnerSlug) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PartnerBuild[]>(key) ?? []
      qc.setQueryData<PartnerBuild[]>(
        key,
        prev.filter((p) => p.slug !== partnerSlug),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: (_d, _e, partnerSlug) => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: buildKeys.partners(partnerSlug) })
    },
  })
}
