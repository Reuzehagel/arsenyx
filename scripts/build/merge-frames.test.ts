import { describe, expect, it } from "bun:test"

import { rankUpDrift, type MergedFrame } from "./merge-frames"

const frame = (name: string, category = "warframes") =>
  ({ name, category }) as MergedFrame

// A stand-in rank-up table, so these cases don't move with the real one:
// Listed gets +100 energy, everything else the +50 default; Disputed is skipped.
const table = {
  rankUpFor: (name: string) => ({
    health: 100,
    shield: 100,
    armor: 0,
    energy: name === "Listed" ? 100 : 50,
  }),
  disputed: { Disputed: "wiki rank-30 value is wrong" },
}

// Regression guard for #387: a frame missing from the rank-up table fell back
// to the default +50 energy without any signal.
describe("rankUpDrift", () => {
  it("flags a frame whose wiki rank-30 gain differs from the table", () => {
    const drift = rankUpDrift(
      [frame("Newframe")],
      { Warframes: { Newframe: { Energy: 200, EnergyRank30: 300 } } },
      table,
    )
    expect(drift).toEqual([
      "Newframe energy: wiki implies +100 at rank 30, rank-up table applies +50",
    ])
  })

  it("accepts frames that match the table (listed or default)", () => {
    const drift = rankUpDrift(
      [frame("Listed"), frame("Plain")],
      {
        Warframes: {
          Listed: { Energy: 150, EnergyRank30: 250 },
          Plain: { Health: 270, HealthRank30: 370, Energy: 100 },
        },
      },
      table,
    )
    expect(drift).toEqual([])
  })

  it("skips 0 placeholders, disputed frames, and non-warframes", () => {
    const drift = rankUpDrift(
      [frame("Brysko"), frame("Disputed"), frame("Itzal", "archwing")],
      {
        Warframes: {
          Brysko: { Energy: 200, EnergyRank30: 0 },
          Disputed: { Energy: 200, EnergyRank30: 290 },
        },
        Archwings: { Itzal: { Energy: 100, EnergyRank30: 999 } },
      },
      table,
    )
    expect(drift).toEqual([])
  })
})
