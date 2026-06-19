import { describe, expect, it } from "vitest"

import { decodeBuild, decodeBuildDoc } from "./build-codec"

// Backward-compatibility lock. These base64 strings were produced by the
// encoder as it shipped before the codec rewrite — they stand in for share
// links already out in the wild. The rewritten decoder MUST keep reading them
// into the same logical build. Do not regenerate these to "fix" a failing
// test: a diff here means the rewrite changed how an existing link decodes.
const GOLDEN = {
  // v1 single-variant warframe: riven in normal-0, forma-only normal-1, ranked
  // mod normal-2, aura (mod+forma), exilus mod, stance forma, arcane, 2 shards,
  // helminth, lich element, incarnon enabled + perks, build name.
  v1Rich:
    "eyJ2IjoxLCJpIjoiL0xvdHVzL1Bvd2Vyc3VpdHMvRXhjYWxpYnVyL0V4Y2FsaWJ1ciIsImMiOiJ3YXJmcmFtZXMiLCJyIjp0cnVlLCJzIjpbeyJtIjp7InUiOiIvTG90dXMvVXBncmFkZXMvTW9kcy9SYW5kb21pemVkL0xvdHVzTW9kdWxhck1lbGVlUmFuZG9tTW9kIiwiciI6OCwicnYiOnsicCI6W3sicyI6IkRhbWFnZSIsInYiOjEuNX0seyJzIjoiQ3JpdGljYWwgQ2hhbmNlIiwidiI6MC45fV0sIm4iOlt7InMiOiJTdGF0dXMgRHVyYXRpb24iLCJ2IjotMC40fV0sImQiOjE4LCJwb2wiOiJtYWR1cmFpIn19fSx7InAiOiJtYWR1cmFpIn0seyJtIjp7InUiOiIvTG90dXMvVXBncmFkZXMvTW9kcy9XYXJmcmFtZS9BdmF0YXJIZWFsdGhNYXhNb2QiLCJyIjoxMH19LHt9LHt9LHt9LHt9LHt9XSwiYSI6eyJwIjoibmFyYW1vbiIsIm0iOnsidSI6Ii9Mb3R1cy9VcGdyYWRlcy9Nb2RzL0F1cmEvUGxheWVyTWVsZWVBdXJhTW9kIiwiciI6NX19LCJlIjp7Im0iOnsidSI6Ii9Mb3R1cy9VcGdyYWRlcy9Nb2RzL1dhcmZyYW1lL0F2YXRhclBhcmtvdXJTcGVlZE1vZCIsInIiOjV9fSwic3QiOnsicCI6InZhemFyaW4ifSwiYXIiOlt7InUiOiIvTG90dXMvVXBncmFkZXMvQ29zbWV0aWNFbmhhbmNlcnMvVXRpbGl0eS9BdmF0YXJBcmNhbmVHdWFyZGlhbiIsInIiOjV9XSwic2giOlsyMyw0OCwwLDAsMF0sImgiOnsic2kiOjIsInUiOiIvTG90dXMvUG93ZXJzdWl0cy9FeGNhbGlidXIvRXhhbHRlZEJsYWRlIiwibiI6IkVjbGlwc2UiLCJzIjoiTWlyYWdlIiwiaW0iOiJlY2xpcHNlLnBuZyIsImQiOiJEYW1hZ2UgYnVmZiJ9LCJuIjoiVGVzdCBFeGNhbCIsImxiIjoiSGVhdCIsImljIjp7ImUiOnRydWUsInAiOltudWxsLCJQZXJrIEIiLG51bGxdfX0=",
  // v1 where incarnonEnabled was undefined but perks were picked — the old
  // encoder wrote `e: false`. An old link like this must still decode to
  // `false` (we never retroactively change what a shipped link means).
  v1IncarnonUntouched:
    "eyJ2IjoxLCJpIjoiL0xvdHVzL1Bvd2Vyc3VpdHMvRXhjYWxpYnVyL0V4Y2FsaWJ1ciIsImMiOiJ3YXJmcmFtZXMiLCJyIjp0cnVlLCJzIjpbeyJtIjp7InUiOiIvTG90dXMvVXBncmFkZXMvTW9kcy9SYW5kb21pemVkL0xvdHVzTW9kdWxhck1lbGVlUmFuZG9tTW9kIiwiciI6OCwicnYiOnsicCI6W3sicyI6IkRhbWFnZSIsInYiOjEuNX0seyJzIjoiQ3JpdGljYWwgQ2hhbmNlIiwidiI6MC45fV0sIm4iOlt7InMiOiJTdGF0dXMgRHVyYXRpb24iLCJ2IjotMC40fV0sImQiOjE4LCJwb2wiOiJtYWR1cmFpIn19fSx7InAiOiJtYWR1cmFpIn0seyJtIjp7InUiOiIvTG90dXMvVXBncmFkZXMvTW9kcy9XYXJmcmFtZS9BdmF0YXJIZWFsdGhNYXhNb2QiLCJyIjoxMH19LHt9LHt9LHt9LHt9LHt9XSwiYSI6eyJwIjoibmFyYW1vbiIsIm0iOnsidSI6Ii9Mb3R1cy9VcGdyYWRlcy9Nb2RzL0F1cmEvUGxheWVyTWVsZWVBdXJhTW9kIiwiciI6NX19LCJlIjp7Im0iOnsidSI6Ii9Mb3R1cy9VcGdyYWRlcy9Nb2RzL1dhcmZyYW1lL0F2YXRhclBhcmtvdXJTcGVlZE1vZCIsInIiOjV9fSwic3QiOnsicCI6InZhemFyaW4ifSwiYXIiOlt7InUiOiIvTG90dXMvVXBncmFkZXMvQ29zbWV0aWNFbmhhbmNlcnMvVXRpbGl0eS9BdmF0YXJBcmNhbmVHdWFyZGlhbiIsInIiOjV9XSwic2giOlsyMyw0OCwwLDAsMF0sImgiOnsic2kiOjIsInUiOiIvTG90dXMvUG93ZXJzdWl0cy9FeGNhbGlidXIvRXhhbHRlZEJsYWRlIiwibiI6IkVjbGlwc2UiLCJzIjoiTWlyYWdlIiwiaW0iOiJlY2xpcHNlLnBuZyIsImQiOiJEYW1hZ2UgYnVmZiJ9LCJuIjoiSW5jYXJub24gdW50b3VjaGVkIiwibGIiOiJIZWF0IiwiaWMiOnsiZSI6ZmFsc2UsInAiOltudWxsLCJQZXJrIFgiLG51bGxdfX0=",
  // v2 multi-variant melee, activeIndex=2.
  v2Rich:
    "eyJ2IjoyLCJpIjoiL0xvdHVzL1dlYXBvbnMvVGVubm8vTWVsZWUvUG9sZWFybS9PcnRob3MiLCJjIjoibWVsZWUiLCJyIjp0cnVlLCJ2cyI6W3sibCI6IkdlbmVyYWwiLCJpZCI6InZBIiwicyI6W3sicCI6Im1hZHVyYWkiLCJtIjp7InUiOiIvTG90dXMvVXBncmFkZXMvTW9kcy9NZWxlZS9XZWFwb25NZWxlZURhbWFnZU1vZCIsInIiOjEwfX0se30se30se30se30se30se30se31dLCJhIjp7fSwiaWMiOnsiZSI6dHJ1ZSwicCI6W251bGwsIkJlcnNlcmtlciJdfSwiZ3MiOiJnZW5lcmFsIHVzZSIsImdkIjoibm90ZXNcbi0gYVxuLSBiIn0seyJsIjoiSGVhdnkiLCJpZCI6InZCIiwicyI6W3t9LHt9LHt9LHt9LHt9LHt9LHt9LHt9XSwiYSI6e30sImljIjp7ImUiOmZhbHNlfX0seyJsIjoiU3RhdHVzIiwiaWQiOiJ2QyIsInMiOlt7fSx7fSx7fSx7fSx7fSx7fSx7fSx7fV0sImEiOnt9LCJkYyI6ImFyY2h3aW5nIn1dLCJsYiI6IkNvbGQiLCJuIjoiTXVsdGkgT3J0aG9zIiwiYWkiOjJ9",
  // Same doc, activeIndex=0 → `ai` omitted.
  v2NoActive:
    "eyJ2IjoyLCJpIjoiL0xvdHVzL1dlYXBvbnMvVGVubm8vTWVsZWUvUG9sZWFybS9PcnRob3MiLCJjIjoibWVsZWUiLCJyIjp0cnVlLCJ2cyI6W3sibCI6IkdlbmVyYWwiLCJpZCI6InZBIiwicyI6W3sicCI6Im1hZHVyYWkiLCJtIjp7InUiOiIvTG90dXMvVXBncmFkZXMvTW9kcy9NZWxlZS9XZWFwb25NZWxlZURhbWFnZU1vZCIsInIiOjEwfX0se30se30se30se30se30se30se31dLCJhIjp7fSwiaWMiOnsiZSI6dHJ1ZSwicCI6W251bGwsIkJlcnNlcmtlciJdfSwiZ3MiOiJnZW5lcmFsIHVzZSIsImdkIjoibm90ZXNcbi0gYVxuLSBiIn0seyJsIjoiSGVhdnkiLCJpZCI6InZCIiwicyI6W3t9LHt9LHt9LHt9LHt9LHt9LHt9LHt9XSwiYSI6e30sImljIjp7ImUiOmZhbHNlfX0seyJsIjoiU3RhdHVzIiwiaWQiOiJ2QyIsInMiOlt7fSx7fSx7fSx7fSx7fSx7fSx7fSx7fV0sImEiOnt9LCJkYyI6ImFyY2h3aW5nIn1dLCJsYiI6IkNvbGQiLCJuIjoiTXVsdGkgT3J0aG9zIn0=",
} as const

describe("golden: existing v1 links still decode", () => {
  const doc = decodeBuildDoc(GOLDEN.v1Rich)!
  it("decodes to a single-variant doc with shared metadata", () => {
    expect(doc).not.toBeNull()
    expect(doc.itemUniqueName).toBe("/Lotus/Powersuits/Excalibur/Excalibur")
    expect(doc.itemCategory).toBe("warframes")
    expect(doc.hasReactor).toBe(true)
    expect(doc.buildName).toBe("Test Excal")
    expect(doc.lichBonusElement).toBe("Heat")
    expect(doc.variants).toHaveLength(1)
  })
  it("preserves the riven in normal-0", () => {
    const riven = doc.variants[0].normalSlots[0].mod!
    expect(riven.rank).toBe(8)
    expect(riven.polarity).toBe("madurai")
    expect(riven.rivenStats?.positives).toEqual([
      { stat: "Damage", value: 1.5 },
      { stat: "Critical Chance", value: 0.9 },
    ])
    expect(riven.rivenStats?.negatives).toEqual([
      { stat: "Status Duration", value: -0.4 },
    ])
  })
  it("preserves forma-only / ranked normal slots, aura, exilus, stance", () => {
    expect(doc.variants[0].normalSlots[1].formaPolarity).toBe("madurai")
    expect(doc.variants[0].normalSlots[1].mod).toBeUndefined()
    expect(doc.variants[0].normalSlots[2].mod?.rank).toBe(10)
    expect(doc.variants[0].auraSlots[0].formaPolarity).toBe("naramon")
    expect(doc.variants[0].auraSlots[0].mod?.rank).toBe(5)
    expect(doc.variants[0].exilusSlot?.mod?.rank).toBe(5)
    expect(doc.variants[0].stanceSlot?.formaPolarity).toBe("vazarin")
  })
  it("preserves arcanes, shards, helminth, incarnon", () => {
    expect(doc.variants[0].arcaneSlots[0]?.rank).toBe(5)
    // Pre-per-variant links stored one shard set; it now seeds variant 0.
    expect(doc.variants[0].shardSlots[0]).toEqual({
      color: "crimson",
      stat: "Ability Strength",
      tauforged: true,
    })
    expect(doc.variants[0].shardSlots[1]).toEqual({
      color: "azure",
      stat: "Health",
      tauforged: false,
    })
    expect(doc.helminthAbility?.slotIndex).toBe(2)
    expect(doc.variants[0].incarnonEnabled).toBe(true)
    expect(doc.variants[0].incarnonPerks).toEqual([null, "Perk B", null])
  })

  it("keeps explicit incarnon=false from a pre-rewrite link", () => {
    const d = decodeBuild(GOLDEN.v1IncarnonUntouched)!
    expect(d.incarnonEnabled).toBe(false)
    expect(d.incarnonPerks).toEqual([null, "Perk X", null])
  })
})

describe("golden: existing v2 links still decode", () => {
  const doc = decodeBuildDoc(GOLDEN.v2Rich)!
  it("decodes all variants in order with per-variant fields", () => {
    expect(doc.variants.map((v) => v.id)).toEqual(["vA", "vB", "vC"])
    expect(doc.variants.map((v) => v.label)).toEqual([
      "General",
      "Heavy",
      "Status",
    ])
    expect(doc.variants[0].incarnonEnabled).toBe(true)
    expect(doc.variants[0].incarnonPerks).toEqual([null, "Berserker"])
    expect(doc.variants[0].guideSummary).toBe("general use")
    expect(doc.variants[0].guideDescription).toBe("notes\n- a\n- b")
    expect(doc.variants[0].normalSlots[0].mod?.rank).toBe(10)
    expect(doc.variants[1].incarnonEnabled).toBe(false)
    expect(doc.variants[2].deploymentContext).toBe("archwing")
    expect(doc.buildName).toBe("Multi Orthos")
    expect(doc.lichBonusElement).toBe("Cold")
  })
  it("surfaces activeIndex from the `ai` field", () => {
    expect(doc.activeIndex).toBe(2)
  })
  it("treats an omitted `ai` as activeIndex 0", () => {
    const d = decodeBuildDoc(GOLDEN.v2NoActive)!
    expect(d.activeIndex ?? 0).toBe(0)
  })
})
