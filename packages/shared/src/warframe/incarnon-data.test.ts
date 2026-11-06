import { describe, expect, it } from "vitest"

import { INCARNON_NAMES } from "./incarnon-data"
import { INCARNON_EVOLUTIONS } from "./incarnon-evolutions"

describe("INCARNON_NAMES", () => {
  it("lists exactly the weapons that have an evolution tree", () => {
    expect([...INCARNON_NAMES].sort()).toEqual(
      Object.keys(INCARNON_EVOLUTIONS).sort(),
    )
  })
})
