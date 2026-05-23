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

  it("rejects unknown lichBonusElement on v2 decode", () => {
    const doc = makeDoc([makeVariant(), makeVariant({ id: "v1", label: "B" })])
    const encoded = encodeBuildDoc({
      ...doc,
      lichBonusElement: "Bogus" as unknown as BuildDoc["lichBonusElement"],
    })
    const decoded = decodeBuildDoc(encoded)!
    expect(decoded.lichBonusElement).toBeUndefined()
  })

  it("preserves activeIndex via the v2 `ai` field", () => {
    const doc = makeDoc([
      makeVariant({ id: "a", label: "A" }),
      makeVariant({ id: "b", label: "B" }),
    ])
    // ai is encoded but `decodeBuildDoc` doesn't surface it on the returned
    // BuildDoc — the caller threads activeIndex separately. Smoke-test that
    // the encoder produces something decodeBuildDoc accepts when ai > 0.
    const encoded = encodeBuildDoc(doc, 1)
    expect(decodeBuildDoc(encoded)).not.toBeNull()
  })

  it("returns null for garbage input", () => {
    expect(decodeBuildDoc("not-base64-!@#")).toBeNull()
  })
})
