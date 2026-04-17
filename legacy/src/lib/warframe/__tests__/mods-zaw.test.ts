import { describe, expect, it } from "bun:test"

import { getModsForItem } from "../mods"

describe("Zaw mod filtering", () => {
  it("returns melee mods for Zaw Component items", () => {
    const mods = getModsForItem({
      type: "Zaw Component",
      category: "Melee",
      name: "Balla",
    })
    expect(mods.length).toBeGreaterThan(0)

    // Should include standard melee mods like Pressure Point
    const hasPressurePoint = mods.some((m) => m.name === "Pressure Point")
    expect(hasPressurePoint).toBe(true)
  })

  it("does not include primary or secondary mods for Zaw Components", () => {
    const mods = getModsForItem({
      type: "Zaw Component",
      category: "Melee",
      name: "Balla",
    })
    const hasSerration = mods.some((m) => m.name === "Serration")
    const hasHornetStrike = mods.some((m) => m.name === "Hornet Strike")
    expect(hasSerration).toBe(false)
    expect(hasHornetStrike).toBe(false)
  })
})
