// Build codec tests
import { describe, it, expect } from "bun:test"

import { createEmptyBuildState } from "@/test/fixtures/builds"
import { createTestMod, VITALITY } from "@/test/fixtures/mods"

import {
  encodeBuild,
  decodeBuild,
  generateBuildUrl,
  extractBuildFromUrl,
} from "../build-codec"

// =============================================================================
// ENCODING TESTS
// =============================================================================

describe("encodeBuild", () => {
  it("encodes empty build state", () => {
    const build = createEmptyBuildState()
    const encoded = encodeBuild(build)

    expect(encoded).toBeTruthy()
    expect(typeof encoded).toBe("string")
    // Should be valid base64
    expect(() => Buffer.from(encoded, "base64")).not.toThrow()
  })

  it("encodes build with reactor", () => {
    const build = createEmptyBuildState({ hasReactor: true })
    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.hasReactor).toBe(true)
  })

  it("encodes build name", () => {
    const build = createEmptyBuildState({ buildName: "My Test Build" })
    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.buildName).toBe("My Test Build")
  })

  it("encodes item information", () => {
    const build = createEmptyBuildState({
      itemUniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
      itemCategory: "warframes",
    })
    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.itemUniqueName).toBe(
      "/Lotus/Powersuits/Excalibur/Excalibur",
    )
    expect(decoded?.itemCategory).toBe("warframes")
  })

  it("encodes mods with their ranks", () => {
    const build = createEmptyBuildState()
    const mod = { ...VITALITY, rank: 7 }
    build.normalSlots[0].mod = mod

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.normalSlots?.[0].mod?.uniqueName).toBe(mod.uniqueName)
    expect(decoded?.normalSlots?.[0].mod?.rank).toBe(7)
  })

  it("encodes forma polarities", () => {
    const build = createEmptyBuildState()
    build.normalSlots[0].formaPolarity = "vazarin"
    build.normalSlots[2].formaPolarity = "madurai"

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.normalSlots?.[0].formaPolarity).toBe("vazarin")
    expect(decoded?.normalSlots?.[2].formaPolarity).toBe("madurai")
  })

  it("encodes aura slot", () => {
    const build = createEmptyBuildState()
    build.auraSlot = {
      id: "aura-0",
      type: "aura",
      innatePolarity: "madurai",
      mod: createTestMod({
        uniqueName: "/Lotus/Upgrades/Mods/Aura/SteelCharge",
        name: "Steel Charge",
        rank: 5,
      }),
    }

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.auraSlot?.mod?.uniqueName).toBe(
      "/Lotus/Upgrades/Mods/Aura/SteelCharge",
    )
  })

  it("encodes exilus slot with mod and forma", () => {
    const build = createEmptyBuildState()
    build.exilusSlot = {
      id: "exilus-0",
      type: "exilus",
      formaPolarity: "naramon",
      mod: createTestMod({ uniqueName: "/Lotus/Test/ExilusMod", rank: 3 }),
    }

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.exilusSlot?.formaPolarity).toBe("naramon")
    expect(decoded?.exilusSlot?.mod?.rank).toBe(3)
  })

  it("encodes arcanes", () => {
    const build = createEmptyBuildState()
    build.arcaneSlots = [
      {
        uniqueName: "/Lotus/Upgrades/Arcanes/ArcaneEnergize",
        name: "Arcane Energize",
        rank: 5,
        rarity: "Legendary",
      },
      {
        uniqueName: "/Lotus/Upgrades/Arcanes/ArcaneGrace",
        name: "Arcane Grace",
        rank: 3,
        rarity: "Legendary",
      },
    ]

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.arcaneSlots).toHaveLength(2)
    expect(decoded?.arcaneSlots?.[0]?.uniqueName).toBe(
      "/Lotus/Upgrades/Arcanes/ArcaneEnergize",
    )
    expect(decoded?.arcaneSlots?.[0]?.rank).toBe(5)
  })

  it("encodes shards", () => {
    const build = createEmptyBuildState()
    build.shardSlots = [
      { color: "crimson", stat: "Health", tauforged: false },
      { color: "amber", stat: "Ability Strength", tauforged: true },
      null,
      { color: "azure", stat: "Energy Max", tauforged: false },
      null,
    ]

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.shardSlots).toHaveLength(5)
    expect(decoded?.shardSlots?.[0]?.color).toBe("crimson")
    expect(decoded?.shardSlots?.[0]?.tauforged).toBe(false)
    expect(decoded?.shardSlots?.[1]?.color).toBe("amber")
    expect(decoded?.shardSlots?.[1]?.tauforged).toBe(true)
    expect(decoded?.shardSlots?.[2]).toBeNull()
  })

  it("produces base64 output that can be URL-encoded", () => {
    const build = createEmptyBuildState({
      buildName: "Test+Build/With?Special&Chars",
    })
    const encoded = encodeBuild(build)

    // Should be valid base64
    expect(() => Buffer.from(encoded, "base64")).not.toThrow()

    // Should roundtrip correctly
    const decoded = decodeBuild(encoded)
    expect(decoded?.buildName).toBe("Test+Build/With?Special&Chars")
  })
})

// =============================================================================
// DECODING TESTS
// =============================================================================

describe("decodeBuild", () => {
  it("decodes encoded build correctly (roundtrip)", () => {
    const build = createEmptyBuildState({
      itemUniqueName: "/Lotus/Powersuits/Volt/Volt",
      itemCategory: "warframes",
      hasReactor: true,
      buildName: "Speed Volt",
    })

    // Add some mods
    build.normalSlots[0].mod = { ...VITALITY, rank: 10 }
    build.normalSlots[0].formaPolarity = "vazarin"

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.itemUniqueName).toBe(build.itemUniqueName)
    expect(decoded?.itemCategory).toBe(build.itemCategory)
    expect(decoded?.hasReactor).toBe(true)
    expect(decoded?.buildName).toBe("Speed Volt")
    expect(decoded?.normalSlots?.[0].mod?.uniqueName).toBe(VITALITY.uniqueName)
    expect(decoded?.normalSlots?.[0].mod?.rank).toBe(10)
    expect(decoded?.normalSlots?.[0].formaPolarity).toBe("vazarin")
  })

  it("returns null for invalid base64", () => {
    const result = decodeBuild("not-valid-base64!!!")
    expect(result).toBeNull()
  })

  it("returns null for invalid JSON", () => {
    const invalidJson = Buffer.from("not json").toString("base64")
    const result = decodeBuild(invalidJson)
    expect(result).toBeNull()
  })

  it("returns null for unknown version", () => {
    const futureVersion = {
      v: 99,
      i: "/Lotus/Test",
      c: "warframes",
      r: false,
      s: [],
    }
    const encoded = Buffer.from(JSON.stringify(futureVersion)).toString(
      "base64",
    )
    const result = decodeBuild(encoded)
    expect(result).toBeNull()
  })

  it("handles empty slots gracefully", () => {
    const build = createEmptyBuildState()
    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.normalSlots).toHaveLength(8)
    // Empty slots should not have mods
    for (const slot of decoded?.normalSlots ?? []) {
      expect(slot.mod).toBeUndefined()
    }
  })

  it("preserves slot order", () => {
    const build = createEmptyBuildState()
    build.normalSlots[2].mod = createTestMod({ uniqueName: "/Lotus/Test/Mod1" })
    build.normalSlots[5].mod = createTestMod({ uniqueName: "/Lotus/Test/Mod2" })
    build.normalSlots[7].mod = createTestMod({ uniqueName: "/Lotus/Test/Mod3" })

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.normalSlots?.[0].mod).toBeUndefined()
    expect(decoded?.normalSlots?.[2].mod?.uniqueName).toBe("/Lotus/Test/Mod1")
    expect(decoded?.normalSlots?.[5].mod?.uniqueName).toBe("/Lotus/Test/Mod2")
    expect(decoded?.normalSlots?.[7].mod?.uniqueName).toBe("/Lotus/Test/Mod3")
  })
})

// =============================================================================
// URL UTILITY TESTS
// =============================================================================

describe("generateBuildUrl", () => {
  it("generates URL with build parameter", () => {
    const build = createEmptyBuildState()
    const url = generateBuildUrl(build, "https://arsenyx.com")

    expect(url).toContain("https://arsenyx.com/create?build=")
  })

  it("URL-encodes the build parameter", () => {
    const build = createEmptyBuildState({ buildName: "Test Build" })
    const url = generateBuildUrl(build, "https://example.com")

    // URL should be parseable
    expect(() => new URL(url)).not.toThrow()
  })
})

describe("extractBuildFromUrl", () => {
  it("extracts build from valid URL", () => {
    const build = createEmptyBuildState({
      itemUniqueName: "/Lotus/Test/Item",
      hasReactor: true,
    })
    const url = generateBuildUrl(build, "https://arsenyx.com")

    const extracted = extractBuildFromUrl(url)

    expect(extracted?.itemUniqueName).toBe("/Lotus/Test/Item")
    expect(extracted?.hasReactor).toBe(true)
  })

  it("returns null for URL without build parameter", () => {
    const result = extractBuildFromUrl("https://arsenyx.com/create")
    expect(result).toBeNull()
  })

  it("returns null for invalid URL", () => {
    const result = extractBuildFromUrl("not a url")
    expect(result).toBeNull()
  })

  it("roundtrips complex build through URL", () => {
    const build = createEmptyBuildState()
    build.itemUniqueName = "/Lotus/Powersuits/Nova/NovaPrime"
    build.itemCategory = "warframes"
    build.hasReactor = true
    build.buildName = "Speedva"
    build.normalSlots[0].mod = { ...VITALITY, rank: 10 }
    build.normalSlots[0].formaPolarity = "vazarin"
    build.shardSlots = [
      { color: "crimson", stat: "Health", tauforged: true },
      null,
      null,
      null,
      null,
    ]

    const url = generateBuildUrl(build, "https://arsenyx.com")
    const extracted = extractBuildFromUrl(url)

    expect(extracted?.itemUniqueName).toBe("/Lotus/Powersuits/Nova/NovaPrime")
    expect(extracted?.buildName).toBe("Speedva")
    expect(extracted?.normalSlots?.[0].mod?.rank).toBe(10)
    expect(extracted?.shardSlots?.[0]?.color).toBe("crimson")
    expect(extracted?.shardSlots?.[0]?.tauforged).toBe(true)
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe("edge cases", () => {
  it("handles unicode in build name", () => {
    const build = createEmptyBuildState({ buildName: "Test 日本語 Build 🎮" })
    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.buildName).toBe("Test 日本語 Build 🎮")
  })

  it("handles very long build names", () => {
    const longName = "A".repeat(1000)
    const build = createEmptyBuildState({ buildName: longName })
    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.buildName).toBe(longName)
  })

  it("handles all 8 mod slots filled", () => {
    const build = createEmptyBuildState()
    for (let i = 0; i < 8; i++) {
      build.normalSlots[i].mod = createTestMod({
        uniqueName: `/Lotus/Test/Mod${i}`,
        rank: i,
      })
      build.normalSlots[i].formaPolarity = "madurai"
    }

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    for (let i = 0; i < 8; i++) {
      expect(decoded?.normalSlots?.[i].mod?.uniqueName).toBe(
        `/Lotus/Test/Mod${i}`,
      )
      expect(decoded?.normalSlots?.[i].mod?.rank).toBe(i)
      expect(decoded?.normalSlots?.[i].formaPolarity).toBe("madurai")
    }
  })

  it("handles all 5 shard slots filled and tauforged", () => {
    const build = createEmptyBuildState()
    build.shardSlots = [
      { color: "crimson", stat: "Health", tauforged: true },
      { color: "amber", stat: "Ability Strength", tauforged: true },
      { color: "azure", stat: "Energy Max", tauforged: true },
      { color: "topaz", stat: "Casting Speed", tauforged: true },
      { color: "violet", stat: "Critical Chance", tauforged: true },
    ]

    const encoded = encodeBuild(build)
    const decoded = decodeBuild(encoded)

    expect(decoded?.shardSlots).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(decoded?.shardSlots?.[i]?.tauforged).toBe(true)
    }
  })
})
