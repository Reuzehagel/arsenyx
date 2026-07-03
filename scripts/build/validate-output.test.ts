import { describe, expect, it } from "bun:test"

import {
  type ValidationIssue,
  validateArcanes,
  validateBrowseItems,
  validateCounts,
  validateMods,
} from "./validate-output"

const goodMod = {
  uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarHealthMaxMod",
  name: "Vitality",
  polarity: "vazarin",
  rarity: "Common",
  baseDrain: 2,
  fusionLimit: 10,
  levelStats: [{ stats: ["+40% Health"] }],
}

function run(fn: (issues: ValidationIssue[]) => void): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  fn(issues)
  return issues
}

describe("validateMods", () => {
  it("passes a well-formed mod", () => {
    expect(run((i) => validateMods([goodMod], i))).toEqual([])
  })

  it("flags missing core fields and non-numeric drain", () => {
    const issues = run((i) =>
      validateMods([{ ...goodMod, polarity: "", baseDrain: undefined }], i),
    )
    expect(issues.map((x) => x.msg)).toEqual([
      "missing/empty polarity",
      "baseDrain is not a number",
    ])
  })

  it("flags duplicate uniqueNames", () => {
    const issues = run((i) => validateMods([goodMod, { ...goodMod }], i))
    expect(issues.map((x) => x.msg)).toEqual(["duplicate uniqueName"])
  })

  it("flags malformed levelStats tiers", () => {
    const issues = run((i) =>
      validateMods([{ ...goodMod, levelStats: [{ stats: [42] }] }], i),
    )
    expect(issues.map((x) => x.msg)).toEqual([
      "levelStats tier without stats[]",
    ])
  })

  it("flags modSetStats without modSet (and vice versa)", () => {
    const issues = run((i) =>
      validateMods([{ ...goodMod, modSetStats: ["bonus"] }], i),
    )
    expect(issues.map((x) => x.msg)).toEqual([
      "modSet/modSetStats present without the other",
    ])
  })
})

describe("validateBrowseItems", () => {
  it("flags empty fields and duplicate slugs within a category", () => {
    const item = { uniqueName: "/Lotus/X", name: "X", slug: "x" }
    const issues = run((i) =>
      validateBrowseItems(
        { warframes: [item, { ...item }, { ...item, slug: "", name: "" }] },
        i,
      ),
    )
    expect(issues.map((x) => x.msg)).toEqual([
      "duplicate slug in warframes",
      "missing/empty name",
      "missing/empty slug",
    ])
  })
})

describe("validateArcanes", () => {
  const goodArcane = {
    uniqueName: "/Lotus/Upgrades/CosmeticEnhancers/Offensive/GraceArcane",
    name: "Arcane Grace",
    slotType: "Warframe",
  }

  it("passes a well-formed arcane", () => {
    expect(run((i) => validateArcanes([goodArcane], i))).toEqual([])
  })

  it("flags missing names", () => {
    const issues = run((i) => validateArcanes([{ ...goodArcane, name: "" }], i))
    expect(issues.map((x) => x.msg)).toEqual(["missing/empty name"])
  })

  it("flags a missing slotType (would silently vanish from every slot picker)", () => {
    const { slotType: _drop, ...noSlot } = goodArcane
    const issues = run((i) => validateArcanes([noSlot], i))
    expect(issues.map((x) => x.msg)).toEqual(["missing/empty slotType"])
  })
})

describe("validateCounts", () => {
  const next = {
    itemCount: 900,
    modCount: 1400,
    arcaneCount: 130,
    perCategory: { warframes: 60, primary: 200 },
  }

  it("passes with no previous meta (first run)", () => {
    expect(run((i) => validateCounts(undefined, next, i))).toEqual([])
  })

  it("tolerates small drops (vaulting / dedup fixes)", () => {
    const prev = { ...next, modCount: 1404, perCategory: { warframes: 61 } }
    expect(run((i) => validateCounts(prev, next, i))).toEqual([])
  })

  it("fails on a large drop in a total", () => {
    const prev = { ...next, modCount: 1595 }
    const issues = run((i) => validateCounts(prev, next, i))
    expect(issues).toHaveLength(1)
    expect(issues[0]?.msg).toContain("modCount dropped 1595 → 1400")
  })

  it("fails on a large per-category drop, including a vanished category", () => {
    const prev = {
      ...next,
      perCategory: { warframes: 60, primary: 200, melee: 250 },
    }
    const issues = run((i) => validateCounts(prev, next, i))
    expect(issues).toHaveLength(1)
    expect(issues[0]?.msg).toContain("perCategory.melee dropped 250 → 0")
  })
})
