import {
  INCARNON_NAMES,
  isInnateIncarnon,
} from "@arsenyx/shared/warframe/incarnon-data"
import { describe, expect, it } from "vitest"

import { extrasFromSaved, withHelminth } from "./extras"

const weapon = (name: string) => ({ name, uniqueName: `/test/${name}` })
const innate = [...INCARNON_NAMES].find(isInnateIncarnon)!
const genesis = [...INCARNON_NAMES].find((n) => !isInnateIncarnon(n))!

describe("extrasFromSaved", () => {
  it("defaults an innate incarnon on and a Genesis-adapter one off", () => {
    expect(extrasFromSaved({}, weapon(innate), "primary").incarnonEnabled).toBe(
      true,
    )
    expect(
      extrasFromSaved({}, weapon(genesis), "primary").incarnonEnabled,
    ).toBe(false)
  })

  it("keeps a saved incarnon toggle over the default", () => {
    expect(
      extrasFromSaved({ incarnonEnabled: false }, weapon(innate), "primary")
        .incarnonEnabled,
    ).toBe(false)
  })

  it("gives an Operator a default amp and nothing else one", () => {
    expect(extrasFromSaved({}, weapon("Op"), "operators").operatorAmp).toBe(
      extrasFromSaved({ operatorAmp: "nonsense" }, weapon("Op"), "operators")
        .operatorAmp,
    )
    expect(
      extrasFromSaved({ operatorAmp: "1-1-1" }, weapon("Gun"), "primary")
        .operatorAmp,
    ).toBeUndefined()
  })
})

describe("withHelminth", () => {
  const ability = (name: string) => ({
    uniqueName: name,
    name,
    description: "",
    imageName: "",
    source: "Test",
  })

  it("allows one subsumed ability per build", () => {
    const one = withHelminth(
      extrasFromSaved({}, weapon("F"), "warframes"),
      0,
      ability("A"),
    )
    expect(Object.keys(withHelminth(one, 2, ability("B")).helminth)).toEqual([
      "2",
    ])
    expect(withHelminth(one, 0, null).helminth).toEqual({})
  })
})
