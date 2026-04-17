import {
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from "@dnd-kit/core"
import { useId, useRef, useState } from "react"

import type { Mod, Arcane, PlacedMod } from "@/lib/warframe/types"

import type { DragItem } from "./use-build-state"

interface UseBuildDragDropProps {
  canEdit: boolean
  compatibleMods: Mod[]
  placeModInSlot: (mod: Mod, rank: number, slotId: string) => void
  moveMod: (sourceSlotId: string, targetSlotId: string) => void
  placeArcaneInSlot: (arcane: Arcane, rank: number, slotIndex: number) => void
  moveArcane: (sourceIndex: number, targetIndex: number) => void
  setActiveSlotId: (slotId: string | null) => void
}

interface UseBuildDragDropReturn {
  activeDragItem: DragItem | null
  sensors: ReturnType<typeof useSensors>
  dndContextId: string
  handleDragStart: (event: DragStartEvent) => void
  handleDragOver: (event: DragOverEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragCancel: () => void
}

export function useBuildDragDrop({
  canEdit,
  compatibleMods,
  placeModInSlot,
  moveMod,
  placeArcaneInSlot,
  moveArcane,
  setActiveSlotId,
}: UseBuildDragDropProps): UseBuildDragDropReturn {
  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null)
  const lastOverRef = useRef<{
    id: string
    data: { type: string; slotId?: string; slotIndex?: number }
  } | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: canEdit ? 3 : 999999,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: canEdit ? 150 : 999999,
        tolerance: 5,
      },
    }),
  )

  const dndContextId = useId()

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as DragItem
    setActiveDragItem(dragData)
    lastOverRef.current = null
    if (
      dragData?.type !== "search-arcane" &&
      dragData?.type !== "placed-arcane"
    ) {
      setActiveSlotId(null)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    const overCurrent = over?.data?.current as
      | { type?: string; slotId?: string; slotIndex?: number }
      | undefined
    if (overCurrent?.type === "slot" || overCurrent?.type === "arcane-slot") {
      lastOverRef.current = {
        id: String(over!.id),
        data: {
          type: overCurrent.type,
          slotId: overCurrent.slotId,
          slotIndex: overCurrent.slotIndex,
        },
      }
    } else {
      lastOverRef.current = null
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event
    const over = event.over ?? lastOverRef.current
    setActiveDragItem(null)
    lastOverRef.current = null

    if (!over) return

    const activeData = active.data.current as DragItem | undefined
    const rawOverData =
      "data" in over &&
      typeof over.data === "object" &&
      over.data !== null &&
      "current" in over.data
        ? (over.data as { current?: unknown }).current
        : (over as { data?: unknown }).data
    const overData = rawOverData as
      | { type?: string; slotId?: string; slotIndex?: number; mod?: PlacedMod }
      | undefined

    if (!activeData || !overData) return

    if (
      overData.type === "slot" &&
      overData.slotId &&
      (activeData.type === "search-mod" || activeData.type === "placed-mod")
    ) {
      const mod = activeData.mod
      const fullMod =
        compatibleMods.find((m) => m.uniqueName === mod.uniqueName) || mod

      if (overData.slotId.startsWith("aura")) {
        const isAura =
          fullMod.type?.toLowerCase().includes("aura") ||
          fullMod.compatName?.toLowerCase() === "aura"
        if (!isAura) return
      }

      if (overData.slotId.startsWith("exilus")) {
        if (!fullMod.isExilus && !fullMod.isUtility) return
      }
    }

    // Case 1: Search Mod -> Slot
    if (
      activeData.type === "search-mod" &&
      overData.type === "slot" &&
      overData.slotId
    ) {
      placeModInSlot(activeData.mod, activeData.rank, overData.slotId)
    }

    // Case 2: Placed Mod -> Slot (Swap/Move)
    if (
      activeData.type === "placed-mod" &&
      overData.type === "slot" &&
      overData.slotId
    ) {
      const sourceSlotId = activeData.slotId
      const targetSlotId = overData.slotId

      if (sourceSlotId !== targetSlotId) {
        moveMod(sourceSlotId, targetSlotId)
      }
    }

    // Case 3: Search Arcane -> Arcane Slot
    if (
      activeData.type === "search-arcane" &&
      overData.type === "arcane-slot" &&
      overData.slotIndex !== undefined
    ) {
      placeArcaneInSlot(activeData.arcane, activeData.rank, overData.slotIndex)
    }

    // Case 4: Placed Arcane -> Arcane Slot (Swap/Move)
    if (
      activeData.type === "placed-arcane" &&
      overData.type === "arcane-slot" &&
      overData.slotIndex !== undefined
    ) {
      const sourceIndex = activeData.slotIndex
      const targetIndex = overData.slotIndex

      if (sourceIndex !== targetIndex) {
        moveArcane(sourceIndex, targetIndex)
      }
    }
  }

  const handleDragCancel = () => {
    setActiveDragItem(null)
    lastOverRef.current = null
  }

  return {
    activeDragItem,
    sensors,
    dndContextId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
