import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"
import { describe, expect, it } from "vitest"

import { variantsOverCap } from "./builds"

const v = (formIndex?: number) => ({ id: "x", label: "x", formIndex })

describe("variantsOverCap (per-form budget)", () => {
  it("allows MAX_VARIANTS in a single (form-less) build", () => {
    const variants = Array.from({ length: MAX_VARIANTS }, () => v())
    expect(variantsOverCap({ variants })).toBe(false)
  })

  it("rejects exceeding MAX_VARIANTS within one form", () => {
    const variants = Array.from({ length: MAX_VARIANTS + 1 }, () => v(0))
    expect(variantsOverCap({ variants })).toBe(true)
  })

  it("allows MAX_VARIANTS per form across two forms (twin-frame)", () => {
    const variants = [
      ...Array.from({ length: MAX_VARIANTS }, () => v(0)),
      ...Array.from({ length: MAX_VARIANTS }, () => v(1)),
    ]
    expect(variantsOverCap({ variants })).toBe(false)
  })

  it("rejects when one form exceeds its budget even if others are fine", () => {
    const variants = [
      v(0),
      ...Array.from({ length: MAX_VARIANTS + 1 }, () => v(1)),
    ]
    expect(variantsOverCap({ variants })).toBe(true)
  })

  it("rejects implausibly many distinct forms (bloat guard)", () => {
    const variants = [v(0), v(1), v(2), v(3), v(4)]
    expect(variantsOverCap({ variants })).toBe(true)
  })

  it("ignores non-object / absent buildData", () => {
    expect(variantsOverCap(null)).toBe(false)
    expect(variantsOverCap({})).toBe(false)
    expect(variantsOverCap({ variants: "nope" })).toBe(false)
  })
})
