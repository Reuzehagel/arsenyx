import { describe, expect, it } from "vitest"

import { decodeBuildDoc, encodeBuildDoc } from "./build-codec"
import type { BuildDoc, BuildVariant } from "./build-doc"
import type { ModSlot } from "./types"

function emptyAuraSlot(i: number): ModSlot {
  return { id: `aura-${i}`, type: "aura" }
}
function emptyNormalSlot(i: number): ModSlot {
  return { id: `normal-${i}`, type: "normal" }
}

function makeVariant(overrides: Partial<BuildVariant> = {}): BuildVariant {
  return {
    id: "v0",
    label: "Main",
    auraSlots: [emptyAuraSlot(0)],
    normalSlots: Array.from({ length: 8 }, (_, i) => emptyNormalSlot(i)),
    arcaneSlots: [],
    ...overrides,
  }
}

function makeDoc(variants: BuildVariant[]): BuildDoc {
  return {
    itemUniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
    itemName: "Excalibur",
    itemCategory: "warframes",
    hasReactor: true,
    shardSlots: [],
    variants,
  }
}

describe("encodeBuildDoc / decodeBuildDoc round-trip", () => {
  it("single-variant doc round-trips via v1 encoder", () => {
    const doc = makeDoc([makeVariant()])
    const encoded = encodeBuildDoc(doc)
    const decoded = decodeBuildDoc(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.variants).toHaveLength(1)
    expect(decoded!.itemUniqueName).toBe(doc.itemUniqueName)
    expect(decoded!.hasReactor).toBe(true)
  })

  it("multi-variant doc preserves variant identity and order", () => {
    const doc = makeDoc([
      makeVariant({ id: "vA", label: "General" }),
      makeVariant({ id: "vB", label: "Melee" }),
      makeVariant({ id: "vC", label: "Eidolon" }),
    ])
    const encoded = encodeBuildDoc(doc)
    const decoded = decodeBuildDoc(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.variants.map((v) => v.id)).toEqual(["vA", "vB", "vC"])
    expect(decoded!.variants.map((v) => v.label)).toEqual([
      "General",
      "Melee",
      "Eidolon",
    ])
  })

  it("preserves explicit incarnonEnabled=false on multi-variant doc", () => {
    const doc = makeDoc([
      makeVariant({ id: "vA", label: "On", incarnonEnabled: true }),
      makeVariant({ id: "vB", label: "Off", incarnonEnabled: false }),
    ])
    const decoded = decodeBuildDoc(encodeBuildDoc(doc))!
    expect(decoded.variants[0].incarnonEnabled).toBe(true)
    expect(decoded.variants[1].incarnonEnabled).toBe(false)
  })

  it("round-trips per-variant guides on multi-variant docs", () => {
    const doc = makeDoc([
      makeVariant({
        id: "a",
        label: "A",
        guideSummary: "use this for steel path",
        guideDescription: "long-form notes\n\n- bullet",
      }),
      makeVariant({ id: "b", label: "B" }),
    ])
    const decoded = decodeBuildDoc(encodeBuildDoc(doc))!
    expect(decoded.variants[0].guideSummary).toBe("use this for steel path")
    expect(decoded.variants[0].guideDescription).toBe(
      "long-form notes\n\n- bullet",
    )
    expect(decoded.variants[1].guideSummary).toBeUndefined()
    expect(decoded.variants[1].guideDescription).toBeUndefined()
  })

  it("round-trips per-variant formIndex on multi-variant docs", () => {
    const doc = makeDoc([
      makeVariant({ id: "sirius", label: "Sirius", formIndex: 0 }),
      makeVariant({ id: "orion", label: "Orion", formIndex: 1 }),
    ])
    const decoded = decodeBuildDoc(encodeBuildDoc(doc))!
    // formIndex 0 is the default → omitted → surfaces as undefined.
    expect(decoded.variants[0].formIndex).toBeUndefined()
    expect(decoded.variants[1].formIndex).toBe(1)
  })

  it("forces v2 so a single-variant non-primary form survives", () => {
    const doc = makeDoc([
      makeVariant({ id: "orion", label: "Orion", formIndex: 1 }),
    ])
    const encoded = encodeBuildDoc(doc)
    // Would be lost if emitted as v1 (no `fi` slot) — must round-trip.
    expect(decodeBuildDoc(encoded)!.variants[0].formIndex).toBe(1)
  })

  it("round-trips per-form shards on a twin-frame doc", () => {
    const doc: BuildDoc = {
      ...makeDoc([
        makeVariant({ id: "sirius", label: "Sirius", formIndex: 0 }),
        makeVariant({ id: "orion", label: "Orion", formIndex: 1 }),
      ]),
      shardSlots: [
        { color: "crimson", stat: "Ability Strength", tauforged: true },
      ],
      formShardSlots: {
        1: [{ color: "azure", stat: "Health", tauforged: false }],
      },
    }
    const decoded = decodeBuildDoc(encodeBuildDoc(doc))!
    // Form 0 stays in the canonical `shardSlots`; form 1 keeps its own set.
    expect(decoded.shardSlots[0]).toEqual({
      color: "crimson",
      stat: "Ability Strength",
      tauforged: true,
    })
    expect(decoded.formShardSlots?.[1]?.[0]).toEqual({
      color: "azure",
      stat: "Health",
      tauforged: false,
    })
  })

  it("rejects unknown lichBonusElement on v2 decode", () => {
    const doc = makeDoc([makeVariant(), makeVariant({ id: "v1", label: "B" })])
    const encoded = encodeBuildDoc({
      ...doc,
      lichBonusElement: "Bogus" as unknown as BuildDoc["lichBonusElement"],
    })
    const decoded = decodeBuildDoc(encoded)!
    expect(decoded.lichBonusElement).toBeUndefined()
  })

  it("round-trips activeIndex via the v2 `ai` field", () => {
    const doc = makeDoc([
      makeVariant({ id: "a", label: "A" }),
      makeVariant({ id: "b", label: "B" }),
      makeVariant({ id: "c", label: "C" }),
    ])
    expect(decodeBuildDoc(encodeBuildDoc(doc, 2))!.activeIndex).toBe(2)
    // activeIndex 0 is the default → omitted → surfaces as undefined.
    expect(decodeBuildDoc(encodeBuildDoc(doc, 0))!.activeIndex).toBeUndefined()
  })

  it("clamps an out-of-range activeIndex to the last variant", () => {
    const doc = makeDoc([
      makeVariant({ id: "a", label: "A" }),
      makeVariant({ id: "b", label: "B" }),
    ])
    expect(decodeBuildDoc(encodeBuildDoc(doc, 99))!.activeIndex).toBe(1)
  })

  it("omits the incarnon enabled flag when it was never set (v1 + v2)", () => {
    // Single-variant → v1. Perks picked but enabled untouched → decodes back
    // to undefined (the default-on heuristic owns it), NOT false.
    const v1 = decodeBuildDoc(
      encodeBuildDoc(
        makeDoc([makeVariant({ incarnonPerks: [null, "Perk", null] })]),
      ),
    )!
    expect(v1.variants[0].incarnonEnabled).toBeUndefined()
    expect(v1.variants[0].incarnonPerks).toEqual([null, "Perk", null])

    // Multi-variant → v2. Same contract.
    const v2 = decodeBuildDoc(
      encodeBuildDoc(
        makeDoc([
          makeVariant({ id: "a", label: "A", incarnonPerks: [null, "P"] }),
          makeVariant({ id: "b", label: "B" }),
        ]),
      ),
    )!
    expect(v2.variants[0].incarnonEnabled).toBeUndefined()
  })

  it("round-trips kitgunComponents on single- and multi-variant docs", () => {
    const kitgunComponents = { grip: "Haymaker", loader: "Splat" }
    // Single variant → v1 path (encodeBuild → shared meta `kc`).
    const single = decodeBuildDoc(
      encodeBuildDoc({ ...makeDoc([makeVariant()]), kitgunComponents }),
    )!
    expect(single.kitgunComponents).toEqual(kitgunComponents)
    // Multi variant → v2 path (encodeSharedMeta `kc`).
    const multi = decodeBuildDoc(
      encodeBuildDoc({
        ...makeDoc([
          makeVariant({ id: "a", label: "A" }),
          makeVariant({ id: "b", label: "B" }),
        ]),
        kitgunComponents,
      }),
    )!
    expect(multi.kitgunComponents).toEqual(kitgunComponents)
  })

  it("omits kitgunComponents when absent", () => {
    const decoded = decodeBuildDoc(encodeBuildDoc(makeDoc([makeVariant()])))!
    expect(decoded.kitgunComponents).toBeUndefined()
  })

  it("returns null for garbage input", () => {
    expect(decodeBuildDoc("not-base64-!@#")).toBeNull()
  })
})
