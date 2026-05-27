import { describe, expect, it } from "vitest"

import { getModsForItem } from "./mods"
import type { Mod } from "./types"

// Tome mods (Canticles / Invocations) carry `compatName: "Tome"` and
// `type: "Secondary Mod"`. They must only appear on Grimoire / Noctua;
// every other secondary (and every non-Tome weapon) must reject them.
//
// Three reachable code paths in getModsForItem all need the guard:
//   1. Typed pistol/throwing branch (Lex, Grimoire)
//   2. Exalted-weapon branch with a trigger (Noctua)
//   3. Typeless `!itemType` fallback (defensive; no live items hit it today)
//
// This test pins all three so a future refactor can't silently drop one and
// reintroduce the regression that prompted the original fix.

const tomeMod: Mod = {
  uniqueName: "/Lotus/Upgrades/Grimoire/FassAuraMod",
  name: "Fass Canticle",
  polarity: "naramon",
  rarity: "Rare",
  baseDrain: 4,
  fusionLimit: 3,
  compatName: "Tome",
  type: "Secondary Mod",
  tradable: true,
}

const regularPistolMod: Mod = {
  uniqueName: "/Lotus/Upgrades/Mods/Pistol/PistolDamageMod",
  name: "Hornet Strike",
  polarity: "madurai",
  rarity: "Rare",
  baseDrain: 4,
  fusionLimit: 5,
  compatName: "Pistol",
  type: "Pistol Mod",
  tradable: true,
}

describe("Tome mod gating", () => {
  it("excludes Tome mods from a regular pistol", () => {
    const result = getModsForItem({ name: "Lex", type: "Pistol" }, [
      tomeMod,
      regularPistolMod,
    ])
    expect(result).toEqual([regularPistolMod])
  })

  it("includes Tome mods on Grimoire", () => {
    const result = getModsForItem({ name: "Grimoire", type: "Pistol" }, [
      tomeMod,
      regularPistolMod,
    ])
    expect(result).toContain(tomeMod)
    expect(result).toContain(regularPistolMod)
  })

  it("includes Tome mods on a future Grimoire Prime variant", () => {
    const result = getModsForItem({ name: "Grimoire Prime", type: "Pistol" }, [
      tomeMod,
    ])
    expect(result).toEqual([tomeMod])
  })

  it("includes Tome mods on Noctua (Dante's exalted)", () => {
    const result = getModsForItem(
      { name: "Noctua", type: "Exalted Weapon", trigger: "Auto" },
      [tomeMod, regularPistolMod],
    )
    expect(result).toContain(tomeMod)
    expect(result).toContain(regularPistolMod)
  })

  it("excludes Tome mods from other exalted pistols (e.g. Regulators)", () => {
    const result = getModsForItem(
      { name: "Regulators", type: "Exalted Weapon", trigger: "Auto" },
      [tomeMod, regularPistolMod],
    )
    expect(result).toEqual([regularPistolMod])
  })

  it("excludes Tome mods from the typeless category fallback for non-Tome items", () => {
    // Items without `type` fall through to the category-keyed fallback.
    // Tome mods must still be gated by item identity, not by category.
    const result = getModsForItem(
      { name: "Some Future Pistol", category: "secondary" },
      [tomeMod, regularPistolMod],
    )
    expect(result).not.toContain(tomeMod)
  })

  it("includes Tome mods in the typeless fallback when the item is Grimoire", () => {
    const result = getModsForItem({ name: "Grimoire", category: "secondary" }, [
      tomeMod,
    ])
    expect(result).toContain(tomeMod)
  })
})
