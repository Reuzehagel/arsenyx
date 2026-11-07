import { describe, expect, it } from "vitest"

import type { DetailItem } from "@/lib/catalog"

import siriusOrion from "../../../public/data/items/warframes/sirius-and-orion.json"
import { computeFormaCount } from "./forma-count"

const item = siriusOrion as unknown as DetailItem

describe("computeFormaCount", () => {
  // Sirius's innate aura is vazarin, Orion's is naramon.
  it("counts a twin-frame form against its own innate polarities", () => {
    const forma = { "aura-0": "vazarin" } as const
    expect(computeFormaCount(item, "warframes", forma, 0)).toBe(0)
    expect(computeFormaCount(item, "warframes", forma, 1)).toBe(1)
  })
})
