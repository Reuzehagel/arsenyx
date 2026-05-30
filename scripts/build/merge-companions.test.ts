import { describe, expect, it } from "bun:test"

import { subTypeOf } from "./merge-companions"

// Regression guard: subTypeOf must route on the wiki `Type` field. Switching
// on `Category` (the old bug) lumped every MOA and Hound into "beast".
describe("subTypeOf", () => {
  it("classifies each robotic companion kind distinctly", () => {
    expect(subTypeOf("Sentinel")).toBe("sentinel")
    expect(subTypeOf("MOA")).toBe("moa")
    expect(subTypeOf("Hound")).toBe("hound")
  })

  it("classifies beast breeds as beast", () => {
    for (const t of ["Kavat", "Kubrow", "Vulpaphyla", "Predasite"]) {
      expect(subTypeOf(t)).toBe("beast")
    }
  })

  it("is case-insensitive and defaults unknown/undefined to beast", () => {
    expect(subTypeOf("moa")).toBe("moa")
    expect(subTypeOf(undefined)).toBe("beast")
    expect(subTypeOf("???")).toBe("beast")
  })
})
