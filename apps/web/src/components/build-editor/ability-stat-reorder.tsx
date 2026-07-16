import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/util/utils"

import type { AbilityStatKey } from "./use-ability-stat-order"
import { closestIndexAt, reorder, useDragGesture } from "./use-drag-gesture"

// Self-contained pointer-drag for reordering the four ability stat rows.
// The gesture mechanics (4px activation, rAF-coalesced ghost,
// elementFromPoint targeting, deferred pointer capture, click-swallow at
// activation, Escape) live in the shared `use-drag-gesture` hook; this file
// only wires up the row-specific source/target/ghost/commit.

const ROW_ATTR = "data-stat-row"
const ROW_INDEX_ATTR = "data-stat-index"
const SOURCE_CLASS = "opacity-30"

type Source = {
  sourceKey: AbilityStatKey
  sourceIndex: number
  ghostLabel: string
  ghostValue: string
}

export function useAbilityStatReorder(
  order: readonly AbilityStatKey[],
  onCommit: (next: AbilityStatKey[]) => void,
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
      onCommit(reorder(order, source.sourceIndex, to))
    },
  })

  const ghost =
    active && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={ghostRef}
            className="bg-popover pointer-events-none fixed top-0 left-0 z-50 rounded px-2 py-0.5 text-xs"
            style={{
              transform: "translate3d(-9999px, -9999px, 0)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.55)",
              willChange: "transform",
            }}
          >
            <div className="flex min-w-[8rem] items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{active.ghostLabel}</span>
              <span className="font-medium tabular-nums">
                {active.ghostValue}
              </span>
            </div>
          </div>,
          document.body,
        )
      : null

  const rowProps = (
    key: AbilityStatKey,
    ghostLabel: string,
    ghostValue: string,
  ) => {
    const index = order.indexOf(key)
    const isTarget =
      active != null &&
      targetIndex != null &&
      targetIndex === index &&
      targetIndex !== active.sourceIndex
    return {
      [ROW_ATTR]: key,
      [ROW_INDEX_ATTR]: index,
      className: cn(
        "cursor-grab select-none",
        isTarget && "ring-primary/40 rounded-sm ring-1",
      ),
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        startDrag(
          { sourceKey: key, sourceIndex: index, ghostLabel, ghostValue },
          e,
        )
      },
      onDragStart: (e: ReactDragEvent<HTMLElement>) => e.preventDefault(),
    }
  }

  return { ghost, rowProps }
}
