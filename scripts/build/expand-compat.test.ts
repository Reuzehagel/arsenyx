import { describe, expect, it } from "bun:test"

import { buildFamilyIndex, makeExpandCompat } from "./expand-compat"

// Minimal catalog fixture: base/Prime Velox (secondary), a standalone weapon,
// and three Excalibur frames sharing a BaseSuit directory.
const VELOX = "/Lotus/Weapons/Tenno/Pistols/TnOdaliskSmg/TnOdaliskSmgPistol"
const VELOX_PRIME = "/Lotus/Weapons/Tenno/Pistols/PrimeVelox/PrimeVeloxPistol"
const FURIS = "/Lotus/Weapons/Tenno/Pistols/Furis/Furis"
const EXCAL = "/Lotus/Powersuits/Excalibur/Excalibur"
const EXCAL_PRIME = "/Lotus/Powersuits/Excalibur/ExcaliburPrime"
const EXCAL_UMBRA = "/Lotus/Powersuits/Excalibur/ExcaliburUmbra"
const EXALTED_BLADE = "/Lotus/Powersuits/Excalibur/ExaltedBlade"

const categoryByUniqueName = new Map<string, string>([
  [VELOX, "secondary"],
  [VELOX_PRIME, "secondary"],
  [FURIS, "secondary"],
  [EXCAL, "warframes"],
  [EXCAL_PRIME, "warframes"],
  [EXCAL_UMBRA, "warframes"],
  [EXALTED_BLADE, "exalted-weapons"],
])
const knownItemUniqueNames = new Set(categoryByUniqueName.keys())

// Weapons carry a `family`; frames do not (they route via the BaseSuit anchor).
const weapons = [
  { uniqueName: VELOX, family: "Velox" },
  { uniqueName: VELOX_PRIME, family: "Velox" },
  { uniqueName: FURIS, family: "Furis" },
  { uniqueName: EXALTED_BLADE, family: "Exalted Blade" },
]

const { familyKeyByUniqueName, familyMembers } = buildFamilyIndex(
  weapons,
  categoryByUniqueName,
)
const expandCompat = makeExpandCompat({
  knownItemUniqueNames,
  categoryByUniqueName,
  familyKeyByUniqueName,
  familyMembers,
})

describe("makeExpandCompat — weapon family fan-out", () => {
  it("expands a base-weapon compat to every variant in the family", () => {
    // The Velox Conclusion bug: compat names base Velox, must reach Velox Prime.
    expect(new Set(expandCompat(VELOX))).toEqual(new Set([VELOX, VELOX_PRIME]))
    // Symmetric: a compat naming the Prime must reach the base too.
    expect(new Set(expandCompat(VELOX_PRIME))).toEqual(
      new Set([VELOX, VELOX_PRIME]),
    )
  })

  it("returns just the item itself when the family has no other members", () => {
    expect(expandCompat(FURIS)).toEqual([FURIS])
  })
})

describe("makeExpandCompat — BaseSuit frame anchor", () => {
  it("expands a BaseSuit anchor to every frame in the directory", () => {
    const anchor = "/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit"
    expect(new Set(expandCompat(anchor))).toEqual(
      new Set([EXCAL, EXCAL_PRIME, EXCAL_UMBRA]),
    )
  })

  it("does not pull a same-directory exalted weapon in as a frame variant", () => {
    const anchor = "/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit"
    expect(expandCompat(anchor)).not.toContain(EXALTED_BLADE)
  })
})

describe("makeExpandCompat — generic class anchors", () => {
  it("returns [] for an unresolved anchor (caller falls back to modPools)", () => {
    expect(
      expandCompat("/Lotus/Weapons/Tenno/Melee/PlayerMeleeWeapon"),
    ).toEqual([])
  })
})

describe("buildFamilyIndex", () => {
  it("registers a uniqueName once when two records share it", () => {
    // A leaked not-yet-released variant can share the base weapon's uniqueName
    // (Athodai / "Athodai Prime"); the family list must not double-count it.
    const cats = new Map([["x", "secondary"]])
    const { familyMembers } = buildFamilyIndex(
      [
        { uniqueName: "x", family: "Athodai" },
        { uniqueName: "x", family: "Athodai" },
      ],
      cats,
    )
    expect(familyMembers.get("secondary Athodai")).toEqual(["x"])
  })

  it("skips items without a family or a known category", () => {
    const cats = new Map([["a", "secondary"]])
    const { familyMembers } = buildFamilyIndex(
      [
        { uniqueName: "a", family: "Foo" },
        { uniqueName: "b", family: null }, // no family
        { uniqueName: "c", family: "Bar" }, // not in category map
      ],
      cats,
    )
    expect(familyMembers.get("secondary Foo")).toEqual(["a"])
    expect([...familyMembers.keys()]).toEqual(["secondary Foo"])
  })
})
