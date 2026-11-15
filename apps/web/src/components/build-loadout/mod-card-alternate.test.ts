// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"

import { alternateSide, fitPairOnScreen } from "./mod-card"

const setWidth = (w: number) => {
  window.innerWidth = w
}

describe("Alternate placement beside an expanded mod card", () => {
  afterEach(() => setWidth(1024))

  it("goes right when there's room, left near the right edge", () => {
    setWidth(1500)
    expect(alternateSide(500)).toBe("right")
    expect(alternateSide(1400)).toBe("left")
  })

  it("has no side on a phone, and the fitted pair puts it on the right", () => {
    setWidth(375)
    expect(alternateSide(187)).toBeNull()
    const { scale, centerX } = fitPairOnScreen()
    expect(scale).toBeLessThan(1)
    expect(alternateSide(centerX, scale)).toBe("right")
  })

  it("never scales up on a wide screen", () => {
    setWidth(2000)
    expect(fitPairOnScreen().scale).toBe(1)
  })
})
