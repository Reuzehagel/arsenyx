import {
  auraSlotId,
  normalSlotId,
  type PlacedMod,
  type SlotId,
} from "@arsenyx/shared/warframe/build-data"
import type { PlexusSlotKind } from "@arsenyx/shared/warframe/mods"

import { slotIndex, slotKind } from "./slot-id"

interface PlexusGroup {
  kind: PlexusSlotKind
  label: string
  count: number
  /** Battle/Tactical slots are unpolarized and can't be forma'd in-game. */
  formable: boolean
  /** Only Integrated mods draw from the Plexus capacity pool. */
  consumesDrain: boolean
}

/** Plexus normal-slot layout in render (and picker-tab) order. Indices map
 *  left-to-right: 0..7 integrated, 8..10 battle, 11..13 tactical. The aura
 *  slot sits inside the Integrated section. */
export const PLEXUS_GROUPS: readonly PlexusGroup[] = [
  {
    kind: "integrated",
    label: "Integrated",
    count: 8,
    formable: true,
    consumesDrain: true,
  },
  {
    kind: "battle",
    label: "Battle",
    count: 3,
    formable: false,
    consumesDrain: false,
  },
  {
    kind: "tactical",
    label: "Tactical",
    count: 3,
    formable: false,
    consumesDrain: false,
  },
]

/** Group for a normal-slot index; null past the end of the layout. */
export function plexusGroupForIndex(index: number): PlexusGroup | null {
  let acc = 0
  for (const g of PLEXUS_GROUPS) {
    if (index < acc + g.count) return g
    acc += g.count
  }
  return null
}

/** Group a Plexus slot belongs to. The aura slot is part of Integrated. */
export function plexusGroupForSlot(id: SlotId): PlexusSlotKind | null {
  const kind = slotKind(id)
  if (kind === "aura") return "integrated"
  if (kind !== "normal") return null
  return plexusGroupForIndex(slotIndex(id))?.kind ?? null
}

type PlexusFillCounts = Record<
  PlexusSlotKind,
  { filled: number; total: number }
>

export interface PlexusPickerState {
  /** Tab the picker should jump to for the active slot. */
  group: PlexusSlotKind | undefined
  /** The aura slot is active — narrow the Integrated tab to Matrix mods. */
  isAura: boolean
  fillCounts: PlexusFillCounts
}

/** What the mod picker needs to mirror the Plexus slot layout: the active
 *  slot's group and the filled/total count per group (aura counted under
 *  Integrated). */
export function plexusPickerState(
  pickerSlot: SlotId | null,
  placed: Partial<Record<SlotId, PlacedMod>>,
  normalSlotCount: number,
  auraSlotCount: number,
): PlexusPickerState {
  const fillCounts: PlexusFillCounts = {
    battle: { filled: 0, total: 0 },
    tactical: { filled: 0, total: 0 },
    integrated: { filled: 0, total: 0 },
  }
  const tally = (kind: PlexusSlotKind, id: SlotId) => {
    fillCounts[kind].total += 1
    if (placed[id]) fillCounts[kind].filled += 1
  }
  for (let i = 0; i < normalSlotCount; i++) {
    const group = plexusGroupForIndex(i)
    if (group) tally(group.kind, normalSlotId(i))
  }
  for (let i = 0; i < auraSlotCount; i++) tally("integrated", auraSlotId(i))
  return {
    group: pickerSlot
      ? (plexusGroupForSlot(pickerSlot) ?? undefined)
      : undefined,
    isAura: !!pickerSlot && slotKind(pickerSlot) === "aura",
    fillCounts,
  }
}
