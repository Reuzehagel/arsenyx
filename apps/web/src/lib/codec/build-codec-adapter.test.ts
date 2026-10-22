import { RIVEN_IMAGE_NAME } from "@arsenyx/shared/warframe/rivens"
import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import type { PlacedArcane, PlacedMod, SlotId } from "@/components/build-editor"
import type { SavedBuildData, SavedVariant } from "@/lib/queries/build-query"
import type { HelminthAbility } from "@/lib/queries/helminth-query"

import {
  buildDocFromVariants,
  normalizeBuildData,
  refreshImagesFromMap,
  savedDataFromBuildDoc,
  stripPersistedImages,
} from "./build-codec-adapter"

function mod(uniqueName: string, imageName?: string): Mod {
  return {
    uniqueName,
    name: uniqueName,
    polarity: "madurai",
    rarity: "Common",
    baseDrain: 4,
    fusionLimit: 5,
    type: "Warframe",
    compatName: "WARFRAME",
    tradable: true,
    ...(imageName ? { imageName } : {}),
  }
}

function placedMod(uniqueName: string, imageName?: string): PlacedMod {
  return { mod: mod(uniqueName, imageName), rank: 5 }
}

function rivenPlaced(imageName: string): PlacedMod {
  return {
    mod: {
      uniqueName: "/Riven/stub",
      name: "Riven Mod",
      imageName,
      polarity: "madurai",
      rarity: "Riven",
      baseDrain: 9,
      fusionLimit: 8,
      compatName: "RIFLE",
      type: "RifleRiven",
      tradable: false,
      rivenStats: {
        positives: [{ stat: "damage", value: 1 }],
        negatives: [],
      },
    },
    rank: 8,
  }
}

function arcane(uniqueName: string, imageName?: string): Arcane {
  return {
    uniqueName,
    name: uniqueName,
    type: "Offensive",
    tradable: true,
    ...(imageName ? { imageName } : {}),
  }
}

function placedArcane(uniqueName: string, imageName?: string): PlacedArcane {
  return { arcane: arcane(uniqueName, imageName), rank: 5 }
}

describe("buildDocFromVariants ⇄ savedDataFromBuildDoc round trip", () => {
  const roar: HelminthAbility = {
    uniqueName: "/Abilities/Roar",
    name: "Roar",
    source: "Rhino",
    description: "",
  }
  // Build-wide editor state + the active variant's slice (the share base).
  const base = {
    item: { uniqueName: "/Warframes/Rhino", name: "Rhino" },
    category: "warframes" as const,
    buildName: "Test Build",
    hasReactor: true,
    slots: { "normal-0": placedMod("/Mods/Serration") },
    formaPolarities: {},
    arcanes: [placedArcane("/Arcanes/Avenger")],
    shards: [],
    helminth: { 0: roar }, // build-wide: must broadcast to every variant
    lichBonusElement: "Heat" as const,
    incarnonEnabled: true,
    incarnonPerks: ["perk-a"],
    normalSlotCount: 2,
    auraSlotCount: 0,
    showStance: false,
  }
  const variants: SavedVariant[] = [
    {
      id: "v0",
      label: "Main",
      slots: { "normal-0": placedMod("/Mods/Serration") },
      arcanes: [placedArcane("/Arcanes/Avenger")],
      incarnonEnabled: true,
      incarnonPerks: ["perk-a"],
    },
    {
      id: "v1",
      label: "Alt",
      slots: { "normal-1": placedMod("/Mods/Vitality") },
      arcanes: [],
      incarnonEnabled: false,
      incarnonPerks: [],
    },
  ]
  const catalog = [mod("/Mods/Serration"), mod("/Mods/Vitality")]
  const arcaneCatalog = [arcane("/Arcanes/Avenger")]

  it("keeps helminth build-wide on the doc (absent from BuildVariant)", () => {
    const doc = buildDocFromVariants(base, variants)
    expect(doc.helminthAbility?.ability.uniqueName).toBe("/Abilities/Roar")
    // BuildVariant has no helminth field — the doc-level value is the only copy.
    expect(doc.variants).toHaveLength(2)
    expect(doc.variants[0]).not.toHaveProperty("helminth")
  })

  it("round-trips per-variant slots/arcanes/incarnon back to SavedBuildData", () => {
    const doc = buildDocFromVariants(base, variants)
    const saved = savedDataFromBuildDoc(doc, catalog, arcaneCatalog)
    expect(saved.variants).toHaveLength(2)
    expect(
      saved.variants?.[0]?.slots["normal-0" as SlotId]?.mod.uniqueName,
    ).toBe("/Mods/Serration")
    expect(
      saved.variants?.[1]?.slots["normal-1" as SlotId]?.mod.uniqueName,
    ).toBe("/Mods/Vitality")
    expect(saved.variants?.[0]?.arcanes[0]?.arcane.uniqueName).toBe(
      "/Arcanes/Avenger",
    )
    expect(saved.variants?.[0]?.incarnonEnabled).toBe(true)
    expect(saved.variants?.[1]?.incarnonEnabled).toBe(false)
  })

  it("broadcasts the build-wide helminth + lich to every decoded variant", () => {
    const doc = buildDocFromVariants(base, variants)
    const saved = savedDataFromBuildDoc(doc, catalog, arcaneCatalog)
    // The encode side stores helminth once (doc-level); projectVariant
    // re-broadcasts it, so both variants surface it on decode.
    expect(saved.variants?.[0]?.helminth?.[0]?.uniqueName).toBe(
      "/Abilities/Roar",
    )
    expect(saved.variants?.[1]?.helminth?.[0]?.uniqueName).toBe(
      "/Abilities/Roar",
    )
    expect(saved.hasReactor).toBe(true)
    expect(saved.lichBonusElement).toBe("Heat")
  })
})

describe("stripPersistedImages", () => {
  it("drops imageName from mods, arcanes, and helminth", () => {
    const data: SavedBuildData = {
      version: 1,
      slots: { "normal-0": placedMod("/Mods/Serration", "serration.png") },
      arcanes: [placedArcane("/Arcanes/Avenger", "avenger.png")],
      helminth: {
        0: {
          uniqueName: "/Abilities/Roar",
          name: "Roar",
          source: "Rhino",
          imageName: "roar.png",
          description: "",
        },
      },
    }
    const stripped = stripPersistedImages(data)
    expect(stripped.slots?.["normal-0"]?.mod.imageName).toBeUndefined()
    expect(stripped.arcanes?.[0]?.arcane.imageName).toBeUndefined()
    expect(stripped.helminth?.[0]?.imageName).toBeUndefined()
    // Identity fields survive for snapshot fidelity.
    expect(stripped.slots?.["normal-0"]?.mod.uniqueName).toBe("/Mods/Serration")
    expect(stripped.slots?.["normal-0"]?.rank).toBe(5)
  })

  it("keeps riven imageName (stub uniqueName isn't in the catalog/map)", () => {
    const data: SavedBuildData = {
      version: 1,
      slots: { "normal-0": rivenPlaced("riven-placeholder.png") },
    }
    const stripped = stripPersistedImages(data)
    expect(stripped.slots?.["normal-0"]?.mod.imageName).toBe(
      "riven-placeholder.png",
    )
  })

  it("strips inside variants too", () => {
    const data: SavedBuildData = {
      version: 1,
      variants: [
        {
          id: "v0",
          label: "Main",
          slots: { "normal-0": placedMod("/Mods/Serration", "serration.png") },
          arcanes: [placedArcane("/Arcanes/Avenger", "avenger.png")],
        },
      ],
    }
    const stripped = stripPersistedImages(data)
    expect(
      stripped.variants?.[0]?.slots["normal-0" as SlotId]?.mod.imageName,
    ).toBeUndefined()
    expect(stripped.variants?.[0]?.arcanes[0]?.arcane.imageName).toBeUndefined()
  })
})

describe("strip → re-resolve round trip", () => {
  const data: SavedBuildData = {
    version: 1,
    slots: { "normal-0": placedMod("/Mods/Serration", "old-serration.png") },
    arcanes: [placedArcane("/Arcanes/Avenger", "old-avenger.png")],
  }

  it("refreshImagesFromMap restores images by uniqueName after strip", () => {
    const stripped = stripPersistedImages(data)
    const resolved = refreshImagesFromMap(stripped, {
      "/Mods/Serration": "https://img.arsenyx.com/Serration-abc.png",
      "/Arcanes/Avenger": "https://img.arsenyx.com/Avenger-def.png",
    })
    expect(resolved.slots?.["normal-0"]?.mod.imageName).toBe(
      "https://img.arsenyx.com/Serration-abc.png",
    )
    expect(resolved.arcanes?.[0]?.arcane.imageName).toBe(
      "https://img.arsenyx.com/Avenger-def.png",
    )
  })

  it("normalizeBuildData re-resolves images from a supplied catalog (editor path)", () => {
    const stripped = stripPersistedImages(data)
    const normalized = normalizeBuildData(
      stripped,
      [mod("/Mods/Serration", "https://img.arsenyx.com/Serration-abc.png")],
      [arcane("/Arcanes/Avenger", "https://img.arsenyx.com/Avenger-def.png")],
    )
    expect(normalized.slots?.["normal-0"]?.mod.imageName).toBe(
      "https://img.arsenyx.com/Serration-abc.png",
    )
    expect(normalized.arcanes?.[0]?.arcane.imageName).toBe(
      "https://img.arsenyx.com/Avenger-def.png",
    )
  })

  it("normalizeBuildData leaves images unresolved when no catalog is supplied (viewer path)", () => {
    const stripped = stripPersistedImages(data)
    const normalized = normalizeBuildData(stripped, [], [])
    // Viewer resolves separately via refreshImagesFromMap + image-map.json.
    expect(normalized.slots?.["normal-0"]?.mod.imageName).toBeUndefined()
  })

  it("pins rivens to RIVEN_IMAGE_NAME, healing a stale/dead stored image", () => {
    // Rivens have a stub uniqueName that's never in the map, and old builds
    // stored a now-dead image (the bare "OmegaMod.png"). Render must override
    // it with the current constant rather than fall back to the dead value.
    const resolved = refreshImagesFromMap(
      { version: 1, slots: { "normal-0": rivenPlaced("OmegaMod.png") } },
      // Non-empty map (riven absent) so the early no-op return doesn't apply.
      { "/Mods/Serration": "https://img.arsenyx.com/Serration-abc.png" },
    )
    expect(resolved.slots?.["normal-0"]?.mod.imageName).toBe(RIVEN_IMAGE_NAME)
  })
})

describe("Alternate mods persist through the save/load pipeline", () => {
  function withAlt(
    slot: PlacedMod,
    altUniqueName: string,
    imageName?: string,
  ): PlacedMod {
    return {
      ...slot,
      alternate: { mod: mod(altUniqueName, imageName), rank: 3 },
    }
  }

  const withAlternates: SavedBuildData = {
    version: 1,
    slots: {
      "normal-0": withAlt(
        rivenPlaced("riven.png"),
        "/Mods/PointBlank",
        "pb.png",
      ),
      "normal-1": placedMod("/Mods/Blaze", "blaze.png"),
    },
    variants: [
      {
        id: "v0",
        label: "Main",
        slots: {
          "normal-0": withAlt(
            rivenPlaced("riven.png"),
            "/Mods/PointBlank",
            "pb.png",
          ),
          "normal-1": placedMod("/Mods/Blaze", "blaze.png"),
        },
        arcanes: [],
      },
      {
        id: "v1",
        label: "Alt",
        slots: {
          "normal-0": withAlt(
            placedMod("/Mods/PrimedPointBlank", "ppb.png"),
            "/Mods/Blaze",
            "blaze.png",
          ),
        },
        arcanes: [],
      },
    ],
  }

  it("strips the nested Alternate's imageName like the slot's own mod", () => {
    const stripped = stripPersistedImages(withAlternates)
    const alt = stripped.slots?.["normal-0"]?.alternate
    expect(alt?.mod.uniqueName).toBe("/Mods/PointBlank")
    expect(alt?.mod.imageName).toBeUndefined()
    expect(alt?.rank).toBe(3)
    expect(
      stripped.variants?.[1]?.slots["normal-0" as SlotId]?.alternate?.mod
        .imageName,
    ).toBeUndefined()
  })

  it("round-trips Alternates per Variant through JSON save → reload", () => {
    const persisted = JSON.parse(
      JSON.stringify(stripPersistedImages(withAlternates)),
    ) as unknown
    const reloaded = refreshImagesFromMap(
      normalizeBuildData(persisted, [], []),
      {
        "/Mods/PointBlank": "https://img/pb.png",
        "/Mods/Blaze": "https://img/blaze.png",
        "/Mods/PrimedPointBlank": "https://img/ppb.png",
      },
    )
    const v0 = reloaded.variants?.[0]?.slots["normal-0" as SlotId]
    const v1 = reloaded.variants?.[1]?.slots["normal-0" as SlotId]
    expect(v0?.mod.rivenStats).toBeDefined()
    expect(v0?.alternate?.mod.uniqueName).toBe("/Mods/PointBlank")
    expect(v0?.alternate?.mod.imageName).toBe("https://img/pb.png")
    expect(v0?.alternate?.rank).toBe(3)
    expect(v1?.mod.uniqueName).toBe("/Mods/PrimedPointBlank")
    expect(v1?.alternate?.mod.uniqueName).toBe("/Mods/Blaze")
    expect(v1?.alternate?.mod.imageName).toBe("https://img/blaze.png")
    expect(
      reloaded.variants?.[0]?.slots["normal-1" as SlotId]?.alternate,
    ).toBeUndefined()
  })

  it("re-resolves Alternate images from the editor catalog", () => {
    const normalized = normalizeBuildData(
      stripPersistedImages(withAlternates),
      [mod("/Mods/PointBlank", "https://img/pb.png")],
      [],
    )
    expect(normalized.slots?.["normal-0"]?.alternate?.mod.imageName).toBe(
      "https://img/pb.png",
    )
  })

  it("leaves a build without Alternates unchanged by the round trip", () => {
    const plain: SavedBuildData = {
      version: 1,
      slots: { "normal-0": placedMod("/Mods/Serration") },
    }
    const reloaded = normalizeBuildData(
      JSON.parse(JSON.stringify(stripPersistedImages(plain))) as unknown,
      [],
      [],
    )
    expect(reloaded).toEqual(plain)
    expect("alternate" in (reloaded.slots?.["normal-0"] ?? {})).toBe(false)
  })
})
