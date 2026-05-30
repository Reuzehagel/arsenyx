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
// emitted by build-items-index (Grimoire ships
// `modPools: ["Pistol", "Tome", "Grimoire"]`, Noctua
// `["Pistol", "Tome", "Noctua"]` — verified against the per-item JSON in
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
    const result = getModsForItem({ modPools: ["Pistol", "Lex"] }, [
      tomeMod,
      regularPistolMod,
    ])
    expect(result).toEqual([regularPistolMod])
  })

  it("includes Tome mods on Grimoire", () => {
    const result = getModsForItem(
      { modPools: ["Pistol", "Tome", "Grimoire"] },
      [tomeMod, regularPistolMod],
    )
    expect(result).toContain(tomeMod)
    expect(result).toContain(regularPistolMod)
  })

  it("includes Tome mods on a future Grimoire Prime variant", () => {
    const result = getModsForItem(
      {
        modPools: ["Pistol", "Tome", "Grimoire Prime", "Grimoire"],
      },
      [tomeMod],
    )
    expect(result).toEqual([tomeMod])
  })

  it("includes Tome mods on Noctua (Dante's exalted)", () => {
    const result = getModsForItem({ modPools: ["Pistol", "Tome", "Noctua"] }, [
      tomeMod,
      regularPistolMod,
    ])
    expect(result).toContain(tomeMod)
    expect(result).toContain(regularPistolMod)
  })

  it("excludes Tome mods from other exalted pistols (e.g. Regulators)", () => {
    const result = getModsForItem({ modPools: ["Pistol", "Regulators"] }, [
      tomeMod,
      regularPistolMod,
    ])
    expect(result).toEqual([regularPistolMod])
  })
})
