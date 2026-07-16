import { describe, expect, it } from "bun:test"

import { mergeMods } from "./merge-mods"
import type { DeUpgrade } from "./read-de"

// Minimal DE upgrade record — mergeMods only needs a mappable polarity/rarity
// and a name plus compatName (so `shouldKeep` retains it).
function upgrade(uniqueName: string, name: string): DeUpgrade {
  return {
    uniqueName,
    name,
    polarity: "AP_ATTACK",
    rarity: "COMMON",
    compatName: "Pistol",
    type: "SECONDARY",
  }
}

// Issue #297: a Primed variant of an exilus mod was dropping to isExilus=false
// because the wiki's IsExilus flag is keyed per-uniqueName and the variant's
// row lacked it. Primed/Umbral variants inherit their base mod's flag.
describe("mergeMods exilus inheritance", () => {
  // Non-"Expert" uniqueNames so the unreleased-Primed drop filter (which keys
  // off an "Expert" suffix + wikiKnownNames) doesn't remove the variant — this
  // suite is about inheritance, not that gate. isPrime keys off the name.
  const base = upgrade("/Mods/SteadyHands", "Steady Hands")
  const primed = upgrade("/Mods/PrimedSteadyHands", "Primed Steady Hands")
  // Only the base is flagged exilus by the wiki lookup.
  const wikiExilus = new Map([[base.uniqueName, true]])

  const byName = (mods: { name: string; isExilus: boolean }[]) =>
    new Map(mods.map((m) => [m.name, m.isExilus]))

  it("propagates the base mod's exilus flag to its Primed variant", () => {
    const { mods } = mergeMods([base, primed], [], new Map(), wikiExilus)
    const ex = byName(mods)
    expect(ex.get("Steady Hands")).toBe(true)
    expect(ex.get("Primed Steady Hands")).toBe(true)
  })

  it("does not invent exilus when the base isn't exilus", () => {
    const plainBase = upgrade("/Mods/Fury", "Fury")
    const plainPrimed = upgrade("/Mods/PrimedFury", "Primed Fury")
    const { mods } = mergeMods(
      [plainBase, plainPrimed],
      [],
      new Map(),
      new Map(),
    )
    const ex = byName(mods)
    expect(ex.get("Fury")).toBe(false)
    expect(ex.get("Primed Fury")).toBe(false)
  })

  it("never clears a flag the variant already carries", () => {
    // Base missing/non-exilus, but the variant itself is flagged — keep it.
    const { mods } = mergeMods(
      [base, primed],
      [],
      new Map(),
      new Map([[primed.uniqueName, true]]),
    )
    expect(byName(mods).get("Primed Steady Hands")).toBe(true)
  })

  it("leaves a variant untouched when its base can't be resolved by name", () => {
    // "Umbral Fiber" derives from Steel Fiber, not a mod literally named
    // "Fiber", so name-stripping finds no base and inherits nothing.
    const umbral = upgrade("/Mods/UmbralFiber", "Umbral Fiber")
    const { mods } = mergeMods([umbral], [], new Map(), new Map())
    expect(byName(mods).get("Umbral Fiber")).toBe(false)
  })
})
