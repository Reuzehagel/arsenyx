import { describe, expect, it } from "vitest"

import { getModsForItem } from "./mods"
import type { Mod } from "./types"

// Tome mods (Canticles / Invocations) carry `compatName: "Tome"` and
// `type: "Secondary Mod"`. They must only appear on Grimoire / Noctua;
// every other secondary (and every non-Tome weapon) must reject them.
//
// Routing is via `modPools` — the build pipeline emits "Tome" only on
// items that accept tome mods (Grimoire, Grimoire variants, Noctua).
// Every other secondary's pool stays at ["Pistol"], so the membership
// check alone gates the mod. The fixtures below mirror the real shapes
// emitted by build-items-index (verified against the per-item JSON in
// apps/web/public/data/items/).

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

describe("Tome mod gating (modPools)", () => {
  it("excludes Tome mods from a regular pistol", () => {
    const result = getModsForItem(
      { name: "Lex", modPools: ["Pistol", "Lex"] },
      [tomeMod, regularPistolMod],
    )
    expect(result).toEqual([regularPistolMod])
  })

  it("includes Tome mods on Grimoire", () => {
    const result = getModsForItem(
      { name: "Grimoire", modPools: ["Pistol", "Tome", "Grimoire"] },
      [tomeMod, regularPistolMod],
    )
    expect(result).toContain(tomeMod)
    expect(result).toContain(regularPistolMod)
  })

  it("includes Tome mods on a future Grimoire Prime variant", () => {
    const result = getModsForItem(
      {
        name: "Grimoire Prime",
        modPools: ["Pistol", "Tome", "Grimoire Prime", "Grimoire"],
      },
      [tomeMod],
    )
    expect(result).toEqual([tomeMod])
  })

  it("includes Tome mods on Noctua (Dante's exalted)", () => {
    const result = getModsForItem(
      { name: "Noctua", modPools: ["Pistol", "Tome", "Noctua"] },
      [tomeMod, regularPistolMod],
    )
    expect(result).toContain(tomeMod)
    expect(result).toContain(regularPistolMod)
  })

  it("excludes Tome mods from other exalted pistols (e.g. Regulators)", () => {
    const result = getModsForItem(
      { name: "Regulators", modPools: ["Pistol", "Regulators"] },
      [tomeMod, regularPistolMod],
    )
    expect(result).toEqual([regularPistolMod])
  })
})

// Fallback (no `modPools`) — for builds/items imported before the field
// existed. Routes by `category` only, with a name-based override for Tome
// weapons.
describe("Tome mod gating (legacy category fallback)", () => {
  it("excludes Tome mods from the typeless category fallback for non-Tome items", () => {
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
