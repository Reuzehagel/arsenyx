import {
  getNormalSlotCount,
  hasExilusSlot,
  hasStanceSlot,
  isWarframeLike,
} from "./slot-layout"
import type { BrowseCategory } from "./types"

// Overframe addresses every mod/arcane slot with a numeric `slot_id`. Its
// meaning depends on the item's category. This module owns BOTH directions of
// that mapping so they can't drift:
//   - `decodeOverframeSlotId` turns a slot_id into our slot type + index
//     (consumed by the web importer, which adapts it to an editor SlotId).
//   - `encodeOverframeSlotId` is the exact inverse (consumed by the api
//     buildstring fallback to re-emit a uniform slot_id).
// It returns slot type + index (not a web `SlotId` string) so this stays free
// of web-only types.

export type OverframeSlotType =
  | "normal"
  | "aura"
  | "exilus"
  | "stance"
  | "arcane"

export type SlotMapping =
  | {
      kind: "mod"
      slotType: "normal" | "aura" | "exilus" | "stance"
      slotIndex: number
    }
  | { kind: "arcane"; index: number }

/**
 * Translate an Overframe `slot_id` (plus category context) into our slot
 * type + index. Returns null when the slot_id can't be mapped. Highest
 * slot_id is leftmost (normal-0): warframes map slot_id 8 → normal-0, and the
 * inversion stretches to N normal slots for layouts that have more.
 */
export function decodeOverframeSlotId(
  slotId: number,
  category: BrowseCategory,
): SlotMapping | null {
  // Necramechs are warframe-shaped for the base 8 slots (slot_id 8 → normal-0 …
  // 1 → normal-7) but have 12 normal slots and NO aura/exilus/arcane — the 4
  // extra slots continue ascending (slot_id 9 → normal-8 … 12 → normal-11).
  // Verified against a real Overframe Voidrig export: slot_id 6 "Necramech
  // Streamline" (polarity naramon, not forma'd) lands on normal-2, whose innate
  // polarity is naramon, and slots 11/12 are normal mods (not arcanes).
  if (category === "necramechs") {
    if (slotId >= 1 && slotId <= 8) {
      return { kind: "mod", slotType: "normal", slotIndex: 8 - slotId }
    }
    if (slotId >= 9 && slotId <= getNormalSlotCount(category)) {
      return { kind: "mod", slotType: "normal", slotIndex: slotId - 1 }
    }
    return null
  }

  // Categories with neither an aura nor an exilus slot (companions, archwing,
  // railjack) are all-normal; slot_id counts down from the highest.
  if (!isWarframeLike(category) && !hasExilusSlot(category)) {
    const normalCount = getNormalSlotCount(category)
    if (slotId >= 1 && slotId <= normalCount) {
      return {
        kind: "mod",
        slotType: "normal",
        slotIndex: normalCount - slotId,
      }
    }
    return null
  }
  if (slotId >= 1 && slotId <= 8) {
    return { kind: "mod", slotType: "normal", slotIndex: 8 - slotId }
  }
  // Melee inserts a Stance slot at slot_id 9, shifting Exilus to 10 and Arcanes
  // to 11+. (Other exilus-bearing non-warframe categories — primary/secondary —
  // have no stance, so Exilus sits at 9.)
  if (hasStanceSlot(category)) {
    if (slotId === 9) return { kind: "mod", slotType: "stance", slotIndex: 0 }
    if (slotId === 10) return { kind: "mod", slotType: "exilus", slotIndex: 0 }
    if (slotId >= 11) return { kind: "arcane", index: slotId - 11 }
    return null
  }
  const warframeLike = isWarframeLike(category)
  if (slotId === 9) {
    return warframeLike
      ? { kind: "mod", slotType: "aura", slotIndex: 0 }
      : { kind: "mod", slotType: "exilus", slotIndex: 0 }
  }
  if (slotId === 10) {
    return warframeLike
      ? { kind: "mod", slotType: "exilus", slotIndex: 0 }
      : { kind: "arcane", index: 0 }
  }
  if (slotId >= 11) {
    return warframeLike
      ? { kind: "arcane", index: slotId - 11 }
      : { kind: "arcane", index: slotId - 10 }
  }
  return null
}

/**
 * Exact inverse of `decodeOverframeSlotId`: given a slot type + index and the
 * category, produce the Overframe slot_id that decodes back to it.
 */
export function encodeOverframeSlotId(
  slotType: OverframeSlotType,
  slotIndex: number,
  category: BrowseCategory,
): number {
  // Necramechs: exact inverse of the necramech decode above. Only normal slots
  // exist — normal-0..7 → slot_id 8..1, normal-8..11 → slot_id 9..12.
  if (category === "necramechs") {
    if (slotType !== "normal") {
      throw new Error(
        `encodeOverframeSlotId: ${category} has no ${slotType} slot`,
      )
    }
    return slotIndex <= 7 ? 8 - slotIndex : slotIndex + 1
  }

  const warframeLike = isWarframeLike(category)
  if (!warframeLike && !hasExilusSlot(category)) {
    // companions / archwing / railjack only have normal slots. Asking for an
    // aura/exilus/arcane slot id on these categories is a programming error
    // (the slot doesn't exist) — throw rather than silently return a bogus
    // normal slot id from the math below.
    if (slotType !== "normal") {
      throw new Error(
        `encodeOverframeSlotId: ${category} has no ${slotType} slot`,
      )
    }
    return getNormalSlotCount(category) - slotIndex
  }
  // Melee: Stance at 9, Exilus at 10, Arcanes at 11+ (inverse of decode above).
  if (hasStanceSlot(category)) {
    switch (slotType) {
      case "normal":
        return 8 - slotIndex
      case "stance":
        return 9
      case "exilus":
        return 10
      case "arcane":
        return 11 + slotIndex
      case "aura":
        throw new Error(`encodeOverframeSlotId: ${category} has no aura slot`)
    }
  }
  switch (slotType) {
    case "normal":
      return 8 - slotIndex
    case "aura":
      return 9
    case "exilus":
      return warframeLike ? 10 : 9
    case "arcane":
      return warframeLike ? 11 + slotIndex : 10 + slotIndex
    case "stance":
      throw new Error(`encodeOverframeSlotId: ${category} has no stance slot`)
  }
}
