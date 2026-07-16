import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import type { PartnerBuild } from "@/lib/queries/partner-builds-query"
import { useItemImage } from "@/lib/use-item-image"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

import { closestIndexAt, reorder, useDragGesture } from "./use-drag-gesture"

// Pointer-drag reorder for the partner-builds chip row in the guide editor.
// The gesture mechanics (activation distance, rAF-coalesced ghost,
// elementFromPoint targeting, click-swallow, Escape) all live in the shared
// `use-drag-gesture` hook — this file only wires up the chip-specific
// source/target/ghost/commit, mirroring `ability-stat-reorder.tsx`.

const ROW_ATTR = "data-partner-row"
const ROW_INDEX_ATTR = "data-partner-index"
const SOURCE_CLASS = "opacity-30"

type Source = {
  sourceIndex: number
  name: string
  uniqueName: string
  imageName: string | null
}

export function usePartnerReorder(
  partners: readonly PartnerBuild[],
  onCommit: (next: PartnerBuild[]) => void,
) {
  const {
    startDrag,
    activeSource: active,
    target: targetIndex,
    ghostRef,
  } = useDragGesture<Source, number>({
    sourceClass: SOURCE_CLASS,
    findTargetAt: (x, y) => closestIndexAt(x, y, ROW_ATTR, ROW_INDEX_ATTR),
    onCommit: (source, to) => {
      if (to === source.sourceIndex) return
      onCommit(reorder(partners, source.sourceIndex, to))
    },
  })

  // Resolve the ghost image the same way the chip does — by uniqueName, so
  // older/imported builds with a rotted stored imageName don't show a broken
  // placeholder mid-drag.
  const itemImage = useItemImage()
  const resolved = active
    ? itemImage(active.uniqueName, active.imageName)
    : undefined
  const ghostSrc = resolved ? getImageUrl(resolved) : null
  const ghost =
    active && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={ghostRef}
            className="bg-popover pointer-events-none fixed top-0 left-0 z-50 inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-2 text-xs"
            style={{
              transform: "translate3d(-9999px, -9999px, 0)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.55)",
              willChange: "transform",
            }}
          >
            <span className="bg-muted flex size-6 shrink-0 items-center justify-center overflow-hidden rounded">
              {ghostSrc ? (
                <img src={ghostSrc} alt="" className="size-full object-cover" />
              ) : null}
            </span>
            <span className="max-w-[14ch] truncate">{active.name}</span>
          </div>,
          document.body,
        )
      : null

  const rowProps = (index: number) => {
    const p = partners[index]
    const isTarget =
      active != null &&
      targetIndex != null &&
      targetIndex === index &&
      targetIndex !== active.sourceIndex
    return {
      [ROW_ATTR]: p?.id ?? index,
      [ROW_INDEX_ATTR]: index,
      className: cn(
        "cursor-grab rounded-full select-none",
        isTarget && "ring-primary/40 ring-2",
      ),
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        startDrag(
          {
            sourceIndex: index,
            name: p?.name ?? "",
            uniqueName: p?.item.uniqueName ?? "",
            imageName: p?.item.imageName ?? null,
          },
          e,
        )
      },
      onDragStart: (e: ReactDragEvent<HTMLElement>) => e.preventDefault(),
    }
  }

  return { ghost, rowProps }
}
