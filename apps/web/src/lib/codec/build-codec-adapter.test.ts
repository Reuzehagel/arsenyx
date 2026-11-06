import {
  decodeBuildDoc,
  encodeBuildDoc,
} from "@arsenyx/shared/warframe/build-codec"
import type {
  HelminthAbility,
  SavedBuildData,
  SavedVariant,
  PlacedArcane,
  PlacedMod,
  SlotId,
} from "@arsenyx/shared/warframe/build-data"
import { RIVEN_IMAGE_NAME } from "@arsenyx/shared/warframe/rivens"
import type { Arcane, Mod, PlacedShard } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import {
  buildDocFromVariants,
  getVariants,
  linkVariants,
  loadBuildData,
  newVariantSeed,
  resolveVariantMode,
  savedDataFromBuildDoc,
  selectVariant,
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

  it("encodes each variant's own per-variant fields, never the active one's", () => {
    const own: SavedVariant[] = [
      {
        ...variants[0]!,
        deploymentContext: "atmospheric",
        operatorAmp: "amp-a",
        focusSchool: "zenurik",
        formIndex: 1,
      },
      // Leaves every per-variant field undefined: it must decode undefined,
      // not inherit the active variant's values from `base`.
      { id: "v1", label: "Alt", slots: {}, arcanes: [] },
    ]
    const doc = buildDocFromVariants(
      { ...base, deploymentContext: "atmospheric", operatorAmp: "amp-a" },
      own,
    )
    const saved = savedDataFromBuildDoc(doc, catalog, arcaneCatalog)
    const [v0, v1] = saved.variants ?? []
    expect(v0).toMatchObject({
      incarnonEnabled: true,
      incarnonPerks: ["perk-a"],
      deploymentContext: "atmospheric",
      operatorAmp: "amp-a",
      focusSchool: "zenurik",
      formIndex: 1,
    })
    expect(v1?.incarnonEnabled).toBeUndefined()
    expect(v1?.deploymentContext).toBeUndefined()
    expect(v1?.operatorAmp).toBeUndefined()
    // Same answer the saved-build path gives for that variant.
    const fromSaved = selectVariant({ version: 1, variants: own }, 1)
    expect(fromSaved.operatorAmp).toBe(v1?.operatorAmp)
    expect(fromSaved.incarnonEnabled).toBe(v1?.incarnonEnabled)
  })
})

describe("selectVariant", () => {
  it("falls back to the first variant for a non-finite index", () => {
    const data: SavedBuildData = {
      version: 1,
      variants: [
        { id: "a", label: "A", slots: {}, arcanes: [] },
        { id: "b", label: "B", slots: {}, arcanes: [], operatorAmp: "x" },
      ],
    }
    expect(selectVariant(data, Number.NaN).operatorAmp).toBeUndefined()
    expect(selectVariant(data, 9).operatorAmp).toBe("x")
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

  it("loadBuildData restores images from the image map after strip (viewer path)", () => {
    const stripped = stripPersistedImages(data)
    const resolved = loadBuildData(stripped, {
      imageMap: {
        "/Mods/Serration": "https://img.arsenyx.com/Serration-abc.png",
        "/Arcanes/Avenger": "https://img.arsenyx.com/Avenger-def.png",
      },
    })
    expect(resolved.slots?.["normal-0"]?.mod.imageName).toBe(
      "https://img.arsenyx.com/Serration-abc.png",
    )
    expect(resolved.arcanes?.[0]?.arcane.imageName).toBe(
      "https://img.arsenyx.com/Avenger-def.png",
    )
  })

  it("loadBuildData re-resolves images from a supplied catalog (editor path)", () => {
    const stripped = stripPersistedImages(data)
    const normalized = loadBuildData(stripped, {
      mods: [
        mod("/Mods/Serration", "https://img.arsenyx.com/Serration-abc.png"),
      ],
      arcanes: [
        arcane("/Arcanes/Avenger", "https://img.arsenyx.com/Avenger-def.png"),
      ],
    })
    expect(normalized.slots?.["normal-0"]?.mod.imageName).toBe(
      "https://img.arsenyx.com/Serration-abc.png",
    )
    expect(normalized.arcanes?.[0]?.arcane.imageName).toBe(
      "https://img.arsenyx.com/Avenger-def.png",
    )
  })

  it("loadBuildData leaves images unresolved when nothing resolves them", () => {
    const stripped = stripPersistedImages(data)
    const normalized = loadBuildData(stripped, {})
    expect(normalized.slots?.["normal-0"]?.mod.imageName).toBeUndefined()
  })

  it("loadBuildData refreshes helminth images from the helminth catalog", () => {
    const resolved = loadBuildData(
      {
        version: 1,
        helminth: {
          0: {
            uniqueName: "/Roar",
            name: "Roar",
            source: "Rhino",
            description: "",
            imageName: "old.png",
          },
        },
      },
      {
        helminth: [
          {
            uniqueName: "/Roar",
            name: "Roar",
            source: "Rhino",
            description: "",
            imageName: "new.png",
          },
        ],
      },
    )
    expect(resolved.helminth?.[0]?.imageName).toBe("new.png")
  })

  it("pins rivens to RIVEN_IMAGE_NAME, healing a stale/dead stored image", () => {
    // Rivens have a stub uniqueName that's never in the map, and old builds
    // stored a now-dead image (the bare "OmegaMod.png"). Render must override
    // it with the current constant rather than fall back to the dead value.
    const resolved = loadBuildData(
      { version: 1, slots: { "normal-0": rivenPlaced("OmegaMod.png") } },
      // Non-empty map (riven absent) so the early no-op return doesn't apply.
      {
        imageMap: {
          "/Mods/Serration": "https://img.arsenyx.com/Serration-abc.png",
        },
      },
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
    const reloaded = loadBuildData(persisted, {
      imageMap: {
        "/Mods/PointBlank": "https://img/pb.png",
        "/Mods/Blaze": "https://img/blaze.png",
        "/Mods/PrimedPointBlank": "https://img/ppb.png",
      },
    })
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
    const normalized = loadBuildData(stripPersistedImages(withAlternates), {
      mods: [mod("/Mods/PointBlank", "https://img/pb.png")],
    })
    expect(normalized.slots?.["normal-0"]?.alternate?.mod.imageName).toBe(
      "https://img/pb.png",
    )
  })

  it("leaves a build without Alternates unchanged by the round trip", () => {
    const plain: SavedBuildData = {
      version: 1,
      slots: { "normal-0": placedMod("/Mods/Serration") },
    }
    const reloaded = loadBuildData(
      JSON.parse(JSON.stringify(stripPersistedImages(plain))) as unknown,
      {},
    )
    expect(reloaded).toEqual(plain)
    expect("alternate" in (reloaded.slots?.["normal-0"] ?? {})).toBe(false)
  })
})

describe("variant mode: per-variant forma + shards", () => {
  const madurai = { "normal-0": "madurai" } as const
  const naramon = { "normal-0": "naramon" } as const
  const crimson = { color: "crimson", stat: "Ability Strength" } as PlacedShard
  const v = (id: string, extra: Partial<SavedVariant> = {}): SavedVariant => ({
    id,
    label: id,
    slots: {},
    arcanes: [],
    ...extra,
  })

  it("copies the legacy top-level forma onto every variant on load", () => {
    const data: SavedBuildData = {
      formaPolarities: madurai,
      variants: [v("a", { shards: [] }), v("b", { shards: [] })],
    }
    expect(getVariants(data).map((x) => x.formaPolarities)).toEqual([
      madurai,
      madurai,
    ])
    expect(selectVariant(data, 1).formaPolarities).toEqual(madurai)
  })

  it("infers linked for legacy builds unless variants already differ", () => {
    const same = { variants: [v("a"), v("b")], formaPolarities: madurai }
    expect(resolveVariantMode(same)).toBe("linked")
    const diffShards = {
      ...same,
      variants: [v("a", { shards: [crimson] }), v("b", { shards: [] })],
    }
    expect(resolveVariantMode(diffShards)).toBe("independent")
    expect(resolveVariantMode({ ...diffShards, variantMode: "linked" })).toBe(
      "linked",
    )
  })

  it("linkVariants copies forma to all, shards only within the same form", () => {
    const variants = [
      v("a", { formaPolarities: naramon, shards: [crimson] }),
      v("b", { formaPolarities: madurai, shards: [] }),
      v("c", { formaPolarities: madurai, shards: [], formIndex: 1 }),
    ]
    const linked = linkVariants(variants, 0)
    expect(linked.map((x) => x.formaPolarities)).toEqual([
      naramon,
      naramon,
      naramon,
    ])
    expect(linked.map((x) => x.shards)).toEqual([[crimson], [crimson], []])
    // Already linked → same reference, so callers can detect "no change".
    expect(linkVariants(linked, 0)).toBe(linked)
  })

  it("seeds a new variant per mode", () => {
    const src = v("a", { formaPolarities: naramon, shards: [crimson] })
    expect(newVariantSeed("independent", src, 0)).toEqual({
      formaPolarities: {},
      shards: [],
    })
    expect(newVariantSeed("linked", src, 0)).toEqual({
      formaPolarities: naramon,
      shards: [crimson],
    })
    // Another twin-frame form keeps the forma but installs its own shards.
    expect(newVariantSeed("linked", src, 1)).toEqual({
      formaPolarities: naramon,
      shards: [],
    })
  })

  it("round-trips per-variant forma through a share link", () => {
    const base = {
      item: { uniqueName: "/Warframes/Rhino", name: "Rhino" },
      category: "warframes" as const,
      hasReactor: true,
      slots: {},
      formaPolarities: naramon,
      arcanes: [],
      shards: [],
      helminth: {},
      normalSlotCount: 2,
      auraSlotCount: 0,
      showStance: false,
    }
    const doc = decodeBuildDoc(
      encodeBuildDoc(
        buildDocFromVariants(base, [
          v("a", { formaPolarities: naramon, shards: [] }),
          v("b", { formaPolarities: madurai, shards: [] }),
        ]),
      ),
    )
    const saved = savedDataFromBuildDoc(doc!, [], [])
    expect(saved.variants?.map((x) => x.formaPolarities)).toEqual([
      naramon,
      madurai,
    ])
    expect(resolveVariantMode(saved)).toBe("independent")
  })
})
