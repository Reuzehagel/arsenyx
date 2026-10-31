import { describe, expect, it } from "vitest"

import { itemMetaDescription } from "./item-meta"

describe("itemMetaDescription", () => {
  it("falls back to a category blurb without a description", () => {
    expect(itemMetaDescription({ name: "Soma" }, "Primary")).toBe(
      "Plan and share Soma (Primary) builds with mods, arcanes, and stats on Arsenyx.",
    )
  })

  it("collapses whitespace and keeps short descriptions whole", () => {
    expect(
      itemMetaDescription(
        { name: "Soma", description: "A\n  rifle." },
        "Primary",
      ),
    ).toBe("A rifle. Plan and share Soma builds on Arsenyx.")
  })

  it("clamps long descriptions to 160 code points with an ellipsis", () => {
    const out = itemMetaDescription(
      { name: "Soma", description: "😀".repeat(200) },
      "Primary",
    )
    expect(Array.from(out)).toHaveLength(160)
    expect(out.endsWith("😀…")).toBe(true)
  })
})
