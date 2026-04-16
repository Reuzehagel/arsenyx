import { describe, expect, it } from "bun:test"

import { getItemsByCategory, getItemBySlug } from "../items"

describe("Zaw item filtering", () => {
  it("includes Zaw Strikes in melee category", () => {
    const meleeItems = getItemsByCategory("melee")
    const strikeNames = [
      "Balla",
      "Cyath",
      "Dehtat",
      "Dokrahm",
      "Kronsh",
      "Mewan",
      "Ooltha",
      "Rabvee",
      "Sepfahn",
      "Plague Keewar",
      "Plague Kripath",
    ]
    for (const name of strikeNames) {
      expect(
        meleeItems.some((i) => i.name === name),
      ).toBe(true)
    }
  })

  it("excludes Zaw Grips from melee category", () => {
    const meleeItems = getItemsByCategory("melee")
    const gripNames = [
      "Peye",
      "Laka",
      "Kwath",
      "Seekalla",
      "Jayap",
      "Korb",
      "Kroostra",
      "Shtung",
      "Plague Akwin",
      "Plague Bokwin",
    ]
    for (const name of gripNames) {
      expect(
        meleeItems.some((i) => i.name === name),
      ).toBe(false)
    }
  })

  it("excludes Zaw Links from melee category", () => {
    const meleeItems = getItemsByCategory("melee")
    const linkNames = ["Jai", "Ruhang", "Ekwana Jai", "Vargeet Jai"]
    for (const name of linkNames) {
      expect(
        meleeItems.some((i) => i.name === name),
      ).toBe(false)
    }
  })

  it("excludes PvP duplicate Strikes", () => {
    const meleeItems = getItemsByCategory("melee")
    // Each Strike should appear exactly once
    const ballaCount = meleeItems.filter(
      (i) => i.name === "Balla",
    ).length
    expect(ballaCount).toBe(1)
  })

  it("returns null for Grip slug lookup", () => {
    const result = getItemBySlug("melee", "peye")
    expect(result).toBeNull()
  })
})
