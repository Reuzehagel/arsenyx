import type { OverframeScrapeResponse } from "@arsenyx/shared/warframe/overframe-wire"
import type { BrowseItem } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import type { DetailItem } from "@/lib/catalog"

import { applyOverframeScrape } from "./index"

const item: BrowseItem = {
  uniqueName: "/Warframes/Rhino",
  name: "Rhino",
  slug: "rhino",
  category: "warframes",
}
// Overframe numbers warframe normal slots right to left: slot_id 8 → normal-0.
const detailItem = {
  ...item,
  polarities: ["madurai", "vazarin", "naramon"],
} as DetailItem

function slot(slotId: number, polarityCode: number, polarity?: "madurai") {
  return { slot_id: slotId, overframeId: null, rank: 0, polarityCode, polarity }
}

function apply(slots: OverframeScrapeResponse["slots"]) {
  return applyOverframeScrape({
    scrape: { source: { url: "x" }, formaCount: null, slots, warnings: [] },
    item,
    category: "warframes",
    detailItem,
    mods: [],
    arcanes: [],
    helminthAbilities: [],
  })
}

describe("applyOverframeScrape polarity mapping", () => {
  it("reads code 0 on an innate slot as a universal forma", () => {
    expect(apply([slot(8, 0)]).data.formaPolarities).toEqual({
      "normal-0": "universal",
    })
  })

  it("keeps the innate polarity for a code the api can't map", () => {
    const result = apply([slot(7, 6)])
    expect(result.data.formaPolarities).toEqual({})
    expect(result.trace[0]?.note).toContain("unknown polarity code 6")
  })

  it("records a mapped polarity that differs from the innate one", () => {
    expect(apply([slot(6, 1, "madurai")]).data.formaPolarities).toEqual({
      "normal-2": "madurai",
    })
  })

  it("records nothing when the mapped polarity is the innate one", () => {
    expect(apply([slot(8, 1, "madurai")]).data.formaPolarities).toEqual({})
  })
})
