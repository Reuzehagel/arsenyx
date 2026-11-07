import type { BuildListItemResponse } from "@arsenyx/shared/api/build-dto"
import type { ComponentProps } from "react"

import {
  BuildCard,
  BuildCardSkeleton,
  BuildRow,
  BuildRowSkeleton,
} from "@/components/builds/build-card"
import { useBuildLayout } from "@/lib/hooks/use-build-layout"
import { cn } from "@/lib/util/utils"

const ROWS_CLASS = "flex flex-col gap-2"
const GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"

type ContainerProps = Omit<ComponentProps<"div">, "children"> & {
  /** Container in card layout; defaults to the responsive grid. */
  cardsClassName?: string
}

function useContainerClass(cardsClassName: string | undefined) {
  const [layout] = useBuildLayout()
  return [
    layout,
    layout === "rows" ? ROWS_CLASS : (cardsClassName ?? GRID_CLASS),
  ] as const
}

/** Builds as cards or rows, following the viewer's layout toggle. */
export function BuildCollection({
  builds,
  cardsClassName,
  className,
  ...rest
}: ContainerProps & { builds: BuildListItemResponse[] }) {
  const [layout, container] = useContainerClass(cardsClassName)
  return (
    <div className={cn(container, className)} {...rest}>
      {builds.map((b) =>
        layout === "rows" ? (
          <BuildRow key={b.id} build={b} />
        ) : (
          <BuildCard key={b.id} build={b} />
        ),
      )}
    </div>
  )
}

/** `count` placeholders in the same layout as {@link BuildCollection}. A
 *  `label` makes it a live loading status announced to screen readers. */
export function BuildCollectionSkeleton({
  count,
  label,
  cardsClassName,
  className,
  ...rest
}: ContainerProps & { count: number; label?: string }) {
  const [layout, container] = useContainerClass(cardsClassName)
  const status = label
    ? ({ role: "status", "aria-busy": true, "aria-live": "polite" } as const)
    : {}
  return (
    <div className={cn(container, className)} {...status} {...rest}>
      {label ? <span className="sr-only">{label}</span> : null}
      {Array.from({ length: count }).map((_, i) =>
        layout === "rows" ? (
          <BuildRowSkeleton key={i} />
        ) : (
          <BuildCardSkeleton key={i} />
        ),
      )}
    </div>
  )
}
