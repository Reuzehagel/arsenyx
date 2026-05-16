import type { Mod } from "@arsenyx/shared/warframe/types"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useState, type ReactNode } from "react"

import { ModCard } from "./mod-card"
import {
  canPlaceIn,
  type BuildSlotsState,
  type SlotId,
} from "./use-build-slots"

const POOL_PREFIX = "pool:"

export const poolDragId = (mod: Mod) => `${POOL_PREFIX}${mod.uniqueName}`
export const isPoolDragId = (id: string) => id.startsWith(POOL_PREFIX)

type ActiveDrag =
  | { source: "slot"; slotId: SlotId; mod: Mod; rank: number }
  | { source: "pool"; mod: Mod }

/**
 * DnD provider for the build editor. Wraps a subtree where both the
 * placed-mod grid and the mod search grid live, so a mod can be dragged
 * from either into a slot. Slot-to-slot drags still trigger `slots.swap`;
 * pool-to-slot drags place the mod (kind- and uniqueness-checked).
 */
export function BuildDndProvider({
  slots,
  children,
}: {
  slots: BuildSlotsState
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  )
  const [active, setActive] = useState<ActiveDrag | null>(null)

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (isPoolDragId(id)) {
      const mod = e.active.data.current?.mod as Mod | undefined
      if (mod) setActive({ source: "pool", mod })
      return
    }
    const slotId = id as SlotId
    const placed = slots.placed[slotId]
    if (placed) {
      setActive({
        source: "slot",
        slotId,
        mod: placed.mod,
        rank: placed.rank,
      })
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null)
    if (!e.over) return
    const overId = String(e.over.id) as SlotId
    const activeId = String(e.active.id)

    if (isPoolDragId(activeId)) {
      const mod = e.active.data.current?.mod as Mod | undefined
      if (!mod) return
      if (!canPlaceIn(mod, overId)) return
      // Skip if the same mod already lives in another slot — matches
      // click-to-place semantics. (The same mod re-dropped on its own slot
      // can't happen: pool ids and slot ids never collide.)
      const existing = slots.placed[overId]
      if (existing?.mod.name === mod.name) return
      if (slots.usedNames.has(mod.name)) return
      slots.placeAt(overId, mod)
      return
    }

    const from = activeId as SlotId
    if (from === overId) return
    slots.swap(from, overId)
  }

  const onDragCancel = () => setActive(null)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      // ~200 pool draggables make the default per-tick measuring expensive.
      // Measure droppables once at drag start; their positions don't shift
      // mid-drag (the grid layout is stable while a card is in flight).
      measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
      // Editor lives inside its own scroll container; autoScroll polls
      // bounding rects every frame and adds noticeable jank with this many
      // subscribers — disable it.
      autoScroll={false}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div
            className="pointer-events-none cursor-grabbing rounded-sm"
            // box-shadow is cheaper than filter: drop-shadow, which forces
            // the browser to re-rasterize the overlay every pointer tick.
            style={{
              transform: "rotate(-2deg)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.55)",
            }}
          >
            <ModCard
              mod={active.mod}
              rank={active.source === "slot" ? active.rank : undefined}
              disableHover
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
