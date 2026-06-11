import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import {
  collectGuideRefs,
  makeRefResolver,
  parseGuideRefHref,
} from "./guide-refs"

const vitality = {
  uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarHealthMaxMod",
  name: "Vitality",
} as Mod

const energize = {
  uniqueName: "/Lotus/Upgrades/CosmeticEnhancers/Utility/EnergyOnEnergyPickup",
  name: "Arcane Energize",
} as Arcane

describe("parseGuideRefHref", () => {
  it("parses mod and arcane hrefs", () => {
    expect(parseGuideRefHref(`mod:${vitality.uniqueName}`)).toEqual({
      kind: "mod",
      uniqueName: vitality.uniqueName,
    })
    expect(parseGuideRefHref(`arcane:${energize.uniqueName}`)).toEqual({
      kind: "arcane",
      uniqueName: energize.uniqueName,
    })
  })

  it("rejects ordinary URLs and malformed refs", () => {
    expect(parseGuideRefHref("https://example.com")).toBeNull()
    expect(parseGuideRefHref("mod:NotAPath")).toBeNull()
    expect(parseGuideRefHref("mod:/has space")).toBeNull()
  })
})

describe("collectGuideRefs", () => {
  it("snapshots referenced entries across multiple sources, deduped", () => {
    const refs = collectGuideRefs(
      [
        `Run [Vitality](mod:${vitality.uniqueName}) always.`,
        undefined,
        `[Vitality](mod:${vitality.uniqueName}) again, plus [Energize](arcane:${energize.uniqueName}).`,
      ],
      [vitality],
      [energize],
    )
    expect(refs).toEqual({ mods: [vitality], arcanes: [energize] })
  })

  it("skips unknown uniqueNames and returns undefined when nothing matches", () => {
    expect(
      collectGuideRefs(["[Gone](mod:/Lotus/Removed)"], [vitality], []),
    ).toBeUndefined()
    expect(collectGuideRefs(["no refs here"], [vitality], [])).toBeUndefined()
  })
})

describe("makeRefResolver", () => {
  it("resolves from snapshots and misses gracefully", () => {
    const resolve = makeRefResolver([vitality], undefined)
    expect(resolve("mod", vitality.uniqueName)).toEqual({
      kind: "mod",
      mod: vitality,
    })
    expect(resolve("arcane", energize.uniqueName)).toBeNull()
    expect(
      makeRefResolver(undefined, undefined)("mod", vitality.uniqueName),
    ).toBeNull()
  })
})
