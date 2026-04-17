import { describe, it, expect } from "bun:test"

import { decodeOverframeBuildString } from "../decode"

// Helper to encode test data into base64
function toBase64(data: unknown): string {
  return Buffer.from(JSON.stringify(data)).toString("base64")
}

// =============================================================================
// decodeOverframeBuildString — slot type assignment
// =============================================================================

describe("decodeOverframeBuildString", () => {
  describe("slot assignment heuristics", () => {
    it("assigns aura, exilus, 8 normal for 10 slots", () => {
      const slots = Array.from({ length: 10 }, (_, i) => ({
        id: String(1000 + i),
        rank: i,
      }))
      const encoded = toBase64(slots)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(10)
      expect(result.slots[0].slotType).toBe("aura")
      expect(result.slots[0].slotIndex).toBe(0)
      expect(result.slots[1].slotType).toBe("exilus")
      expect(result.slots[1].slotIndex).toBe(0)
      for (let i = 2; i < 10; i++) {
        expect(result.slots[i].slotType).toBe("normal")
        expect(result.slots[i].slotIndex).toBe(i - 2)
      }
    })

    it("assigns exilus + 8 normal for 9 slots", () => {
      const slots = Array.from({ length: 9 }, (_, i) => ({
        id: String(2000 + i),
        rank: 5,
      }))
      const encoded = toBase64(slots)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(9)
      expect(result.slots[0].slotType).toBe("exilus")
      expect(result.slots[0].slotIndex).toBe(0)
      for (let i = 1; i < 9; i++) {
        expect(result.slots[i].slotType).toBe("normal")
        expect(result.slots[i].slotIndex).toBe(i - 1)
      }
    })

    it("assigns 8 normal for 8 slots", () => {
      const slots = Array.from({ length: 8 }, (_, i) => ({
        id: String(3000 + i),
        rank: 10,
      }))
      const encoded = toBase64(slots)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(8)
      for (let i = 0; i < 8; i++) {
        expect(result.slots[i].slotType).toBe("normal")
        expect(result.slots[i].slotIndex).toBe(i)
      }
    })

    it("treats other counts as all normal", () => {
      const slots = Array.from({ length: 5 }, (_, i) => ({
        id: String(4000 + i),
        rank: 3,
      }))
      const encoded = toBase64(slots)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(5)
      for (const slot of result.slots) {
        expect(slot.slotType).toBe("normal")
      }
    })
  })

  describe("input format handling", () => {
    it("handles array-of-tuples format", () => {
      const data = [
        ["5924", 10],
        ["1234", 5],
      ]
      const encoded = toBase64(data)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(2)
      expect(result.slots[0].overframeId).toBe("5924")
      expect(result.slots[0].rank).toBe(10)
      expect(result.slots[1].overframeId).toBe("1234")
      expect(result.slots[1].rank).toBe(5)
    })

    it("handles object-with-slots wrapper", () => {
      const data = {
        slots: [
          { id: "100", rank: 3 },
          { id: "200", rank: 7 },
        ],
      }
      const encoded = toBase64(data)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(2)
      expect(result.slots[0].overframeId).toBe("100")
      expect(result.slots[1].overframeId).toBe("200")
    })

    it("handles modId/level alternative field names", () => {
      const data = [{ modId: "999", level: 10 }]
      const encoded = toBase64(data)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(1)
      expect(result.slots[0].overframeId).toBe("999")
      expect(result.slots[0].rank).toBe(10)
    })

    it("returns empty slots for unparseable input", () => {
      const encoded = Buffer.from("not valid json at all").toString("base64")
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(0)
    })
  })

  describe("base64url handling", () => {
    it("normalizes base64url characters (- and _)", () => {
      const data = [{ id: "100", rank: 5 }]
      const json = JSON.stringify(data)
      // Standard base64
      const standard = Buffer.from(json).toString("base64")
      // Convert to base64url variant
      const urlVariant = standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

      const result = decodeOverframeBuildString(urlVariant)
      expect(result.slots).toHaveLength(1)
      expect(result.slots[0].overframeId).toBe("100")
    })
  })

  describe("edge cases", () => {
    it("skips null entries in the array", () => {
      const data = [{ id: "100", rank: 5 }, null, { id: "200", rank: 3 }]
      const encoded = toBase64(data)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(2)
    })

    it("skips entries with missing id", () => {
      const data = [{ rank: 5 }, { id: "200", rank: 3 }]
      const encoded = toBase64(data)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(1)
      expect(result.slots[0].overframeId).toBe("200")
    })

    it("skips entries with non-finite rank", () => {
      const data = [
        { id: "100", rank: "not_a_number" },
        { id: "200", rank: 3 },
      ]
      const encoded = toBase64(data)
      const result = decodeOverframeBuildString(encoded)

      expect(result.slots).toHaveLength(1)
      expect(result.slots[0].overframeId).toBe("200")
    })
  })
})
