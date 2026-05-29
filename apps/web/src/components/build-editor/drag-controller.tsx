import type { Mod } from "@arsenyx/shared/warframe/types"
import {
  createContext,
  useContext,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"

import { ModCard } from "./mod-card"
import {
  canPlaceIn,
  type BuildSlotsState,
  type SlotId,
} from "./use-build-slots"
import { useDragGesture } from "./use-drag-gesture"

// Custom drag layer for the build editor. Replaces @dnd-kit because that
// library's `useDraggable` subscribes every draggable to a single React
// context — with ~200 mod cards in the pool, every slot-transition during
// a drag forced all 200 to re-render. Memo can't help (context bypasses
// memo), so we own the pointer plumbing ourselves.
//
// Design:
// - Source elements register only an `onPointerDown` handler; they never
//   subscribe to drag state, so they don't re-render mid-drag.
// - Slots subscribe to two narrow contexts (`isOver`, `isSource`) — at
//   most ~10 consumers, recommit on slot-boundary crossings is cheap.
// - Drop target is the slot under the cursor (`elementFromPoint`), which
//   fixes the off-by-one selection from dnd-kit's rect-intersection
//   strategy.
//
// The reusable pointer mechanics (4px activation, rAF ghost, click-swallow,
// pointer capture, Escape) live in `use-drag-gesture.ts`.

const SLOT_DATA_ATTR = "data-drop-slot-id"
const SOURCE_CLASS = "is-drag-source"

type Source =
  | { kind: "pool"; mod: Mod }
  | { kind: "slot"; slotId: SlotId; mod: Mod; rank: number }

type StartFn = (source: Source, e: ReactPointerEvent) => void

const StartContext = createContext<StartFn | null>(null)
const TargetContext = createContext<SlotId | null>(null)
const SourceSlotContext = createContext<SlotId | null>(null)
const DraggingContext = createContext<boolean>(false)

export function DragController({
  slots,
  children,
}: {
  slots: BuildSlotsState
  children: ReactNode
}) {
  const { startDrag, activeSource, target, ghostRef } = useDragGesture<
    Source,
    SlotId
  >({
    sourceClass: SOURCE_CLASS,
    findTargetAt: (x, y) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return null
      const slot = (el as Element).closest(`[${SLOT_DATA_ATTR}]`)
      return slot
        ? ((slot.getAttribute(SLOT_DATA_ATTR) ?? null) as SlotId | null)
        : null
    },
    onCommit: (source, targetSlot) => {
      const s = slots
      if (source.kind === "pool") {
        if (!canPlaceIn(source.mod, targetSlot)) return
        const existing = s.placed[targetSlot]
        if (existing?.mod.name === source.mod.name) return
        if (s.usedNames.has(source.mod.name)) return
        s.placeAt(targetSlot, source.mod)
        return
      }
      if (source.slotId === targetSlot) return
      s.swap(source.slotId, targetSlot)
    },
  })

  const activeSourceSlot =
    activeSource?.kind === "slot" ? activeSource.slotId : null
  const isAnyDragging = activeSource != null

  return (
    <StartContext.Provider value={startDrag}>
      <DraggingContext.Provider value={isAnyDragging}>
        <SourceSlotContext.Provider value={activeSourceSlot}>
          <TargetContext.Provider value={target}>
            {children}
            {activeSource &&
              typeof document !== "undefined" &&
              createPortal(
                <DragGhost
                  ghostRef={ghostRef}
                  mod={activeSource.mod}
                  rank={
                    activeSource.kind === "slot" ? activeSource.rank : undefined
                  }
                />,
                document.body,
              )}
          </TargetContext.Provider>
        </SourceSlotContext.Provider>
      </DraggingContext.Provider>
    </StartContext.Provider>
  )
}

function DragGhost({
  ghostRef,
  mod,
  rank,
}: {
  ghostRef: RefObject<HTMLDivElement | null>
  mod: Mod
  rank: number | undefined
}) {
  return (
    <div
      ref={ghostRef}
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{
        // Park off-screen until the first pointermove repositions us; the
        // listener calls `positionGhost` on rAF after mount.
        transform: "translate3d(-9999px, -9999px, 0)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.55)",
        willChange: "transform",
      }}
    >
      <ModCard mod={mod} rank={rank} disableHover />
    </div>
  )
}

/** Returns the slot-id data-attribute key callers should set on droppable wrappers. */
export const DROP_SLOT_ATTR = SLOT_DATA_ATTR

/** Subscribe a source element to drag start. Returns `null` outside a controller. */
export function useStartDrag() {
  return useContext(StartContext)
}

export function useIsDropTarget(slotId: SlotId | undefined): boolean {
  const target = useContext(TargetContext)
  return slotId != null && target === slotId
}

export function useIsDragSourceSlot(slotId: SlotId | undefined): boolean {
  const source = useContext(SourceSlotContext)
  return slotId != null && source === slotId
}

export function useIsAnyDragActive(): boolean {
  return useContext(DraggingContext)
}
