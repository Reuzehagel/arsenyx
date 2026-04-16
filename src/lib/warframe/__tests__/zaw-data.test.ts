import { describe, expect, it } from "bun:test"

import {
  ZAW_STRIKES,
  ZAW_GRIPS,
  ZAW_LINKS,
  getZawWeaponType,
  isZawStrike,
  isZawGrip,
  isZawLink,
  calculateZawBaseStats,
} from "../zaw-data"

describe("Zaw data", () => {
  it("has 11 strikes", () => {
    expect(ZAW_STRIKES).toHaveLength(11)
  })

  it("has 10 grips", () => {
    expect(ZAW_GRIPS).toHaveLength(10)
  })

  it("has 16 links", () => {
    expect(ZAW_LINKS).toHaveLength(16)
  })

  it("identifies strikes correctly", () => {
    expect(isZawStrike("Balla")).toBe(true)
    expect(isZawStrike("Plague Kripath")).toBe(true)
    expect(isZawStrike("Peye")).toBe(false)
    expect(isZawStrike("Jai")).toBe(false)
  })

  it("identifies grips correctly", () => {
    expect(isZawGrip("Peye")).toBe(true)
    expect(isZawGrip("Plague Akwin")).toBe(true)
    expect(isZawGrip("Balla")).toBe(false)
  })

  it("identifies links correctly", () => {
    expect(isZawLink("Jai")).toBe(true)
    expect(isZawLink("Vargeet Jai II")).toBe(true)
    expect(isZawLink("Balla")).toBe(false)
  })

  it("resolves weapon type from strike + grip", () => {
    expect(getZawWeaponType("Balla", "Peye")).toBe("Dagger")
    expect(getZawWeaponType("Balla", "Jayap")).toBe("Staff")
    expect(getZawWeaponType("Dokrahm", "Kwath")).toBe("Scythe")
    expect(getZawWeaponType("Dokrahm", "Kroostra")).toBe("Heavy Blade")
  })

  it("calculates base stats with grip and link modifiers", () => {
    const strikeAttack = {
      damage: { impact: 11.2, puncture: 134.4, slash: 78.4 },
      crit_chance: 18,
      crit_mult: 2,
      status_chance: 18,
      speed: 1,
    }
    const stats = calculateZawBaseStats({
      strikeAttack,
      strikeName: "Balla",
      gripName: "Peye",
      linkName: "Jai",
    })
    expect(stats.totalDamage).toBeCloseTo(224 - 4)
    expect(stats.speed).toBeCloseTo(1 + 0.083)
  })
})
