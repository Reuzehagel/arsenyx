import { describe, expect, it } from "vitest"

import { decodeOverframeSlotId, encodeOverframeSlotId } from "./overframe-slots"
import type { BrowseCategory } from "./types"

// encode∘decode must be the identity for every slot_id the decoder accepts —
// this is what guarantees the api buildstring inverse and the web interpreter
// agree (the bug this module was extracted to kill).
describe("overframe slot mapping round-trips", () => {
  const categories: BrowseCategory[] = [
    "warframes",
    "necramechs",
    "companions",
    "primary",
    "melee",
    "archwing",
  ]

  for (const category of categories) {
    it(`encode(decode(slot_id)) === slot_id for ${category}`, () => {
      for (let slotId = 1; slotId <= 12; slotId++) {
        const mapping = decodeOverframeSlotId(slotId, category)
        if (!mapping) continue
        const slotType = mapping.kind === "arcane" ? "arcane" : mapping.slotType
        const slotIndex =
          mapping.kind === "arcane" ? mapping.index : mapping.slotIndex
        expect(encodeOverframeSlotId(slotType, slotIndex, category)).toBe(
          slotId,
        )
      }
    })
  }

  it("maps warframe slot ids to the expected layout", () => {
    expect(decodeOverframeSlotId(8, "warframes")).toEqual({
      kind: "mod",
      slotType: "normal",
      slotIndex: 0,
    })
    expect(decodeOverframeSlotId(9, "warframes")).toEqual({
      kind: "mod",
      slotType: "aura",
      slotIndex: 0,
    })
    expect(decodeOverframeSlotId(10, "warframes")).toEqual({
      kind: "mod",
      slotType: "exilus",
      slotIndex: 0,
    })
    expect(decodeOverframeSlotId(11, "warframes")).toEqual({
      kind: "arcane",
      index: 0,
    })
  })

  it("maps melee slot ids with a Stance slot at 9 (Exilus→10, Arcanes→11+)", () => {
    expect(decodeOverframeSlotId(8, "melee")).toEqual({
      kind: "mod",
      slotType: "normal",
      slotIndex: 0,
    })
    expect(decodeOverframeSlotId(9, "melee")).toEqual({
      kind: "mod",
      slotType: "stance",
      slotIndex: 0,
    })
    expect(decodeOverframeSlotId(10, "melee")).toEqual({
      kind: "mod",
      slotType: "exilus",
      slotIndex: 0,
    })
    expect(decodeOverframeSlotId(11, "melee")).toEqual({
      kind: "arcane",
      index: 0,
    })
  })

  it("counts companion normals down from the highest slot id", () => {
    // 10 normal slots → slot_id 1 is the last normal, slot_id 10 the first.
    expect(decodeOverframeSlotId(1, "companions")).toEqual({
      kind: "mod",
      slotType: "normal",
      slotIndex: 9,
    })
    expect(decodeOverframeSlotId(10, "companions")).toEqual({
      kind: "mod",
      slotType: "normal",
      slotIndex: 0,
    })
    // Companions have no aura/exilus, so slot_id 11 is unmapped.
    expect(decodeOverframeSlotId(11, "companions")).toBeNull()
  })

  it("throws when asked to encode a non-existent slot type for a category", () => {
    // Companions/archwing/railjack only have normal slots. Asking for aura/
    // exilus/arcane is a programming error — must throw, not return garbage.
    expect(() => encodeOverframeSlotId("arcane", 0, "companions")).toThrow()
    expect(() => encodeOverframeSlotId("aura", 0, "archwing")).toThrow()
    expect(() => encodeOverframeSlotId("exilus", 0, "railjack")).toThrow()
    // Warframes still accept every slot type.
    expect(() => encodeOverframeSlotId("arcane", 0, "warframes")).not.toThrow()
  })
})
