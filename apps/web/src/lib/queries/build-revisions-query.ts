import type {
  BuildRevisionResponse,
  BuildRevisionsResponse,
} from "@arsenyx/shared/api/build-dto"
import { queryOptions } from "@tanstack/react-query"

import { apiFetch, loaderError } from "@/lib/util/api-client"

export type BuildRevision = BuildRevisionResponse

/**
 * A build's edit log. Session-gated and permission-gated server-side (the same
 * check that governs editing), so this is only ever fetched for a viewer the
 * detail payload already marked `isOwner`.
 *
 * `enabled: false` by default — the history lives behind a button, and fetching
 * it on every build page view would spend a query nobody asked for. The sheet
 * enables it on open.
 */
export const buildRevisionsQuery = (slug: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["build", slug, "revisions"] as const,
    queryFn: async (): Promise<BuildRevisionsResponse> =>
      apiFetch<BuildRevisionsResponse>(
        `/builds/${encodeURIComponent(slug)}/revisions`,
      ).catch((err) => {
        throw loaderError(err, "failed_load_revisions")
      }),
    enabled,
    // The log only changes when someone saves the build, which is rare next to
    // opening the sheet. Re-opening inside the window reuses the cached list.
    staleTime: 60_000,
  })
