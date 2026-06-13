import {
  BROWSE_CATEGORY_IDS,
  CATEGORY_LABELS,
} from "@arsenyx/shared/warframe/categories"
import { describe, expect, it } from "vitest"

import { CATEGORIES } from "./warframe"

describe("CATEGORIES (browse tab order)", () => {
  it("lists every browse category exactly once", () => {
    // Tab order is web-local and intentionally differs from the canonical id
    // order, so it can't be derived from the shared list — this guards against
    // a category that exists + validates + has a label yet was left off the
    // tabs and so never renders in any browse surface.
    const ids = CATEGORIES.map((c) => c.id)
    expect([...ids].sort()).toEqual([...BROWSE_CATEGORY_IDS].sort())
    expect(ids).toHaveLength(BROWSE_CATEGORY_IDS.length)
  })

  it("labels each tab from the shared CATEGORY_LABELS source", () => {
    for (const { id, label } of CATEGORIES) {
      expect(label).toBe(CATEGORY_LABELS[id])
    }
  })
})
