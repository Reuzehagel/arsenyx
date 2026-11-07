import { useQueryClient } from "@tanstack/react-query"

import { Skeleton } from "@/components/ui/skeleton"
import {
  partnerBuildsQuery,
  type PartnerBuild,
} from "@/lib/queries/partner-builds-query"

import { hasBuildFrom } from "./build-trail"

/**
 * Height-matched placeholder for the lazy {@link RelatedBuildsStrip}. The strip
 * fetches its partners with a plain useQuery and renders nothing until they
 * arrive, so without a reservation it pops in after the route commits and shoves
 * the guide + footer down (the build pages' dominant CLS). The loader warms the
 * partners query, so by first paint we already know whether the strip will
 * render — reserve its one-row height only when it's non-empty, so builds
 * without partners don't get a phantom gap. Mirrors related-builds.tsx's outer
 * structure (heading + a single chip row) so the reserved height matches the
 * real strip at every breakpoint — keep the two in sync.
 */
export function RelatedBuildsStripFallback({ slug }: { slug: string }) {
  const partners = useQueryClient().getQueryData<PartnerBuild[]>(
    partnerBuildsQuery(slug).queryKey,
  )
  // A hop from another build (see ./build-trail) pins that build into the
  // strip, so it renders a row even for a build with no partners of its own.
  // Read raw history state — this fallback deliberately stays off the router.
  if (!hasBuildFrom(window.history.state) && !partners?.length) return null
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-24" />
      <div className="-mx-1 flex gap-2 px-1 pb-1">
        <div className="bg-card flex w-80 shrink-0 items-center gap-3 rounded-md border py-2 pr-4 pl-2">
          <Skeleton className="size-12 shrink-0 rounded" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  )
}
