import { describe, expect, it } from "bun:test"

import type { MergedFrame } from "./merge-frames"
import { deriveHelminthAbilities } from "./merge-helminth"

const ability = (name: string) => ({
  uniqueName: `/Lotus/${name}`,
  name,
  description: "",
})

// Regression guard for #428: the non-primary twin only exists under `forms`.
describe("deriveHelminthAbilities", () => {
  it("finds the subsumable ability of each twin-frame form", () => {
    const sirius = {
      name: "Sirius & Orion",
      abilities: [ability("Jade Stars")],
    }
    const orion = {
      name: "Orion & Sirius",
      abilities: [ability("Astral Shell")],
    }
    const twin = { ...sirius, forms: [sirius, orion] } as unknown as MergedFrame

    const out = deriveHelminthAbilities([twin], [])
    expect(out.map((a) => [a.name, a.source])).toEqual([
      ["Astral Shell", "Orion & Sirius"],
      ["Jade Stars", "Sirius & Orion"],
    ])
  })
})
