import {
  auraSlotId,
  normalSlotId,
  type PlacedMod,
  type SlotId,
} from "@arsenyx/shared/warframe/build-data"

import { slotIndex, slotKind } from "./slot-id"

export interface SlotLayout {
  normalSlotCount: number
  auraSlotCount: number
  showExilus: boolean
  showStance: boolean
  /** A locked exalted stance is display-only — never selectable or placeable. */
  stanceLocked?: boolean
}

/** Reading-order rank: aura-0, stance, exilus, aura-1..N, normal-0..N. */
function slotOrderIndex(id: SlotId): number {
  if (id === "stance") return 1
  if (id === "exilus") return 2
  const n = slotIndex(id)
  if (slotKind(id) === "aura") return n === 0 ? 0 : 2 + n
  return 1000 + n
}

const byReadingOrder = (a: SlotId, b: SlotId) =>
  slotOrderIndex(a) - slotOrderIndex(b)

/** The slots a user can place into, in reading order. */
export function getVisibleSlots(layout: SlotLayout): SlotId[] {
  const out: SlotId[] = []
  for (let i = 0; i < layout.auraSlotCount; i++) out.push(auraSlotId(i))
  if (layout.showStance && !layout.stanceLocked) out.push("stance")
  if (layout.showExilus) out.push("exilus")
  for (let i = 0; i < layout.normalSlotCount; i++) out.push(normalSlotId(i))
  return out.sort(byReadingOrder)
}

/**
 * Placed mods in slot reading order, regardless of equip order. Elemental
 * combination is slot-order-sensitive, so stat math must never see equip
 * order (#272).
 */
export function placedModsInSlotOrder(
  placed: Partial<Record<SlotId, PlacedMod>>,
): PlacedMod[] {
  return (Object.entries(placed) as [SlotId, PlacedMod | undefined][])
    .filter((e): e is [SlotId, PlacedMod] => e[1] !== undefined)
    .sort(([a], [b]) => byReadingOrder(a, b))
    .map(([, p]) => p)
}

/**
 * Drop entries for slots this layout lacks. A legacy or imported build can
 * carry a mod (or forma) in a slot the item doesn't have; left in, it renders
 * nowhere yet still feeds the capacity math and is re-saved forever.
 */
export function dropOrphanSlots<T>(
  seed: Partial<Record<SlotId, T>>,
  layout: SlotLayout,
): Partial<Record<SlotId, T>> {
  const visible = new Set<SlotId>(getVisibleSlots(layout))
  const entries = Object.entries(seed) as [SlotId, T][]
  if (entries.every(([id]) => visible.has(id))) return seed
  const out: Partial<Record<SlotId, T>> = {}
  for (const [id, v] of entries) if (visible.has(id)) out[id] = v
  return out
}

/** Next empty slot after `current` in reading order, or null. */
export function getNextEmptySlot(
  current: SlotId,
  layout: SlotLayout,
  placed: Partial<Record<SlotId, PlacedMod>>,
): SlotId | null {
  const list = getVisibleSlots(layout)
  const start = list.indexOf(current)
  if (start === -1) return null
  for (let i = start + 1; i < list.length; i++) {
    if (!placed[list[i]]) return list[i]
  }
  return null
}
