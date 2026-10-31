import { describe, expect, it } from "bun:test"

import { rankUpDrift, type MergedFrame } from "./merge-frames"

const frame = (name: string, category = "warframes") =>
  ({ name, category }) as MergedFrame

// Regression guard for #387: a frame missing from the rank-up table fell back
// to the default +50 energy without any signal.
describe("rankUpDrift", () => {
  it("flags a frame whose wiki rank-30 gain differs from the table", () => {
    const drift = rankUpDrift([frame("Newframe")], {
      Warframes: { Newframe: { Energy: 200, EnergyRank30: 300 } },
    })
    expect(drift).toEqual([
      "Newframe energy: wiki implies +100 at rank 30, rank-up table applies +50",
    ])
  })

  it("accepts frames that match the table (listed or default)", () => {
    const drift = rankUpDrift([frame("Baruuk"), frame("Excalibur")], {
      Warframes: {
        Baruuk: { Energy: 150, EnergyRank30: 250 },
        Excalibur: { Health: 270, HealthRank30: 370, Energy: 100 },
      },
    })
    expect(drift).toEqual([])
  })

  it("skips 0 placeholders, disputed frames, and non-warframes", () => {
    const drift = rankUpDrift(
      [frame("Brysko"), frame("Narin"), frame("Itzal", "archwing")],
      {
        Warframes: {
          Brysko: { Energy: 200, EnergyRank30: 0 },
          Narin: { Energy: 200, EnergyRank30: 290 },
        },
        Archwings: { Itzal: { Energy: 100, EnergyRank30: 999 } },
      },
    )
    expect(drift).toEqual([])
  })
})
