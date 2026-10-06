import { describe, expect, it } from "vitest"

import {
  decodeBuild,
  decodeBuildDoc,
  encodeBuild,
  encodeBuildDoc,
} from "./build-codec"
import type { BuildDoc, BuildVariant } from "./build-doc"
import type { BuildState } from "./types"

function operatorBuild(operatorAmp: string): BuildState {
  return {
    itemUniqueName: "/Lotus/Powersuits/Operator/Operator",
    itemName: "Operator",
    itemCategory: "operators",
    hasReactor: false,
    auraSlots: [],
    normalSlots: [],
    arcaneSlots: [],
    shardSlots: [],
    baseCapacity: 0,
    currentCapacity: 0,
    formaCount: 0,
    operatorAmp,
  }
}

function variant(id: string, label: string, operatorAmp: string): BuildVariant {
  return {
    id,
    label,
    auraSlots: [],
    normalSlots: [],
    arcaneSlots: [],
    shardSlots: [],
    operatorAmp,
  }
}

describe("Operator Amp build codec", () => {
  it.each(["mote-amp", "sirocco", "1-7-7", "5-4-7"])(
    "round-trips %s through a v1 share link",
    (operatorAmp) => {
      const decoded = decodeBuild(encodeBuild(operatorBuild(operatorAmp)))

      expect(decoded).not.toBeNull()
      expect(decoded?.itemCategory).toBe("operators")
      expect(decoded?.operatorAmp).toBe(operatorAmp)
    },
  )

  it("rejects an invalid modular Amp configuration while decoding", () => {
    const decoded = decodeBuild(encodeBuild(operatorBuild("9-9-9")))

    expect(decoded).not.toBeNull()
    expect(decoded?.operatorAmp).toBeUndefined()
  })

  it("preserves a different Amp on each v2 build variant", () => {
    const doc: BuildDoc = {
      itemUniqueName: "/Lotus/Powersuits/Operator/Operator",
      itemName: "Operator",
      itemCategory: "operators",
      hasReactor: false,
      variants: [
        variant("main", "Main", "1-7-7"),
        variant("eidolon", "Eidolon", "5-4-7"),
      ],
    }

    const decoded = decodeBuildDoc(encodeBuildDoc(doc, 1))

    expect(decoded).not.toBeNull()
    expect(decoded?.activeIndex).toBe(1)
    expect(decoded?.variants[0]?.operatorAmp).toBe("1-7-7")
    expect(decoded?.variants[1]?.operatorAmp).toBe("5-4-7")
  })
})
