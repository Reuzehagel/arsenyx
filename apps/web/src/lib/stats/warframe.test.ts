import type { Mod, Warframe } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { calculateWarframeStats } from "./warframe"

// Regression: PR #285 — the Umbral set bonus is NOT uniform across the set.
// Per wiki.warframe.com/w/Umbral_Set, Vitality/Fiber scale ×1.3/×1.8 while
// Intensify scales ×1.25/×1.75 (max-rank in-game: 100/130/180% health-armor,
// 44/55/77% strength).

const umbralMod = (name: string, stat: string): Mod => ({
  uniqueName: `/test/${name}`,
  name,
  type: "Warframe",
  tradable: false,
  polarity: "umbra",
  rarity: "Legendary",
  baseDrain: 6,
  fusionLimit: 10,
  compatName: "WARFRAME",
  levelStats: Array.from({ length: 11 }, () => ({ stats: [stat] })),
})

const VITALITY = umbralMod("Umbral Vitality", "+100% Health")
const FIBER = umbralMod("Umbral Fiber", "+100% Armor")
const INTENSIFY = umbralMod("Umbral Intensify", "+44% Ability Strength")

const FRAME: Warframe = {
  uniqueName: "/test/frame",
  name: "Test Frame",
  tradable: false,
  health: 100,
  shield: 100,
  armor: 100,
  power: 100,
}

const calc = (mods: Mod[]) =>
  calculateWarframeStats({
    warframe: FRAME,
    mods: mods.map((mod) => ({ mod, rank: 10 })),
    arcanes: [],
    shards: [],
    skipRankUpBonus: true,
  })

describe("Umbral set bonuses", () => {
  it("applies no set bonus with a single Umbral mod", () => {
    const stats = calc([VITALITY])
    expect(stats.health.modified).toBe(200) // +100%
    const strength = calc([INTENSIFY])
    expect(strength.abilityStrength.modified).toBe(144) // +44%
  })

  it("scales Vitality ×1.3 but Intensify ×1.25 with 2 mods", () => {
    const stats = calc([VITALITY, INTENSIFY])
    expect(stats.health.modified).toBe(230) // +130%
    expect(stats.abilityStrength.modified).toBe(155) // +55%
  })

  it("scales Vitality/Fiber ×1.8 but Intensify ×1.75 with the full set", () => {
    const stats = calc([VITALITY, FIBER, INTENSIFY])
    expect(stats.health.modified).toBe(280) // +180%
    expect(stats.armor.modified).toBe(280) // +180%
    expect(stats.abilityStrength.modified).toBe(177) // +77%
  })
})
