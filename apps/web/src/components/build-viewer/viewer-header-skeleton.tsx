import { Skeleton } from "@/components/ui/skeleton"

/**
 * Height-matched placeholder for the lazy {@link ViewerHeader}. Deliberately
 * mirrors that component's outer structure — the `bg-card … p-4` card, the
 * clamp-sized image box (which dominates the card height on desktop), and the
 * same row/column flex rules — so it reserves the identical height across
 * breakpoints and the loadout below doesn't shift when the real header swaps
 * in. Keep this in sync with viewer-header.tsx's outer layout. `animate-pulse`
 * marks it as a loading state; `aria-hidden` keeps the bars out of the a11y
 * tree.
 */
export function ViewerHeaderSkeleton() {
  return (
    <div className="bg-card mb-4 rounded-lg border p-4" aria-hidden>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Skeleton className="size-[clamp(4rem,8vw,6rem)] shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  )
}
