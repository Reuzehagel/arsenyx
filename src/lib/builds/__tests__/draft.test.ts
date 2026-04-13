import { describe, expect, it } from "bun:test"

import { BuildDraftPayloadSchema, buildStateToDraftPayload } from "../draft"

describe("buildStateToDraftPayload", () => {
  it("converts hydrated build state into the thin draft shape", () => {
    const payload = buildStateToDraftPayload({
      name: "Rhino Tank",
      visibility: "PUBLIC",
      organizationSlug: "clan-dojo",
      partnerBuildSlugs: ["primer-secondary"],
      guide: {
        summary: "Short guide",
        description: "Long guide",
      },
      buildState: {
        itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
        itemName: "Rhino",
        itemCategory: "warframes",
        itemImageName: "rhino.png",
        hasReactor: true,
        auraSlots: [{
          id: "aura-0",
          type: "aura",
          mod: {
            uniqueName: "/Lotus/Upgrades/Mods/Aura/SteelCharge",
            name: "Steel Charge",
            baseDrain: -4,
            fusionLimit: 5,
            polarity: "madurai",
            rank: 5,
            rarity: "Rare",
          },
        }],
        exilusSlot: {
          id: "exilus-0",
          type: "exilus",
          formaPolarity: "umbra",
        },
        normalSlots: [
          {
            id: "normal-0",
            type: "normal",
            mod: {
              uniqueName: "/Lotus/Upgrades/Mods/Warframe/Intensify",
              name: "Intensify",
              baseDrain: 6,
              fusionLimit: 5,
              polarity: "madurai",
              rank: 5,
              rarity: "Rare",
            },
          },
          { id: "normal-1", type: "normal" },
        ],
        arcaneSlots: [
          {
            uniqueName:
              "/Lotus/Types/Gameplay/Eidolon/FocusLens/ArcaneGuardian",
            name: "Arcane Guardian",
            rank: 5,
            rarity: "Rare",
          },
          null,
        ],
        shardSlots: [
          {
            color: "crimson",
            stat: "Ability Strength",
            tauforged: false,
          },
          null,
          null,
          null,
          null,
        ],
        baseCapacity: 60,
        currentCapacity: 3,
        formaCount: 2,
        buildName: "Rhino Tank",
        helminthAbility: {
          slotIndex: 1,
          ability: {
            uniqueName: "/Lotus/Powersuits/Rhino/RhinoRoar",
            name: "Roar",
            source: "Rhino",
          },
        },
      },
    })

    expect(payload).toEqual({
      name: "Rhino Tank",
      description: null,
      visibility: "PUBLIC",
      itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      itemCategory: "warframes",
      organizationSlug: "clan-dojo",
      guide: {
        summary: "Short guide",
        description: "Long guide",
      },
      partnerBuildSlugs: ["primer-secondary"],
      build: {
        hasReactor: true,
        slots: [
          {
            slotId: "aura-0",
            mod: {
              uniqueName: "/Lotus/Upgrades/Mods/Aura/SteelCharge",
              rank: 5,
            },
          },
          {
            slotId: "exilus-0",
            formaPolarity: "umbra",
          },
          {
            slotId: "normal-0",
            mod: {
              uniqueName: "/Lotus/Upgrades/Mods/Warframe/Intensify",
              rank: 5,
            },
          },
        ],
        arcanes: [
          {
            slotIndex: 0,
            uniqueName:
              "/Lotus/Types/Gameplay/Eidolon/FocusLens/ArcaneGuardian",
            rank: 5,
          },
        ],
        shards: [
          {
            slotIndex: 0,
            color: "crimson",
            stat: "Ability Strength",
            tauforged: false,
          },
        ],
        helminthAbility: {
          slotIndex: 1,
          uniqueName: "/Lotus/Powersuits/Rhino/RhinoRoar",
        },
      },
    })

    expect(BuildDraftPayloadSchema.safeParse(payload).success).toBe(true)
  })
})

describe("BuildDraftPayloadSchema", () => {
  it("rejects duplicate slot ids", () => {
    const result = BuildDraftPayloadSchema.safeParse({
      name: "Duplicate Slots",
      itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      itemCategory: "warframes",
      build: {
        hasReactor: true,
        slots: [{ slotId: "normal-0" }, { slotId: "normal-0" }],
      },
    })

    expect(result.success).toBe(false)
  })

  it("rejects unexpected derived fields", () => {
    const result = BuildDraftPayloadSchema.safeParse({
      name: "Derived Fields",
      itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      itemCategory: "warframes",
      build: {
        hasReactor: true,
        slots: [],
        baseCapacity: 60,
      },
    })

    expect(result.success).toBe(false)
  })
})
