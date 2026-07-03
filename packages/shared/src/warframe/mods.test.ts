import { describe, expect, it } from "vitest"

import {
  type ModConflictMap,
  deriveAbilityAugmentConflicts,
  getAugmentAbility,
  getBlockedByConflict,
  getConflictingUniqueNames,
  getModSetCode,
  getModsForItem,
  groupConflictingMods,
  isStanceMod,
  modsConflict,
} from "./mods"
import type { Mod } from "./types"

describe("isStanceMod", () => {
  // The build emits stance mods with type "Stance" (singular, like
  // "Primary"/"Melee") — NOT "Stance Mod". This is the contract that broke
  // the stance picker; pin it against the real emitted value.
  it("matches the real emitted type 'Stance'", () => {
    expect(isStanceMod({ type: "Stance" })).toBe(true)
  })

  it("does not match the old fabricated 'Stance Mod' value", () => {
    expect(isStanceMod({ type: "Stance Mod" })).toBe(false)
  })

  it("does not match non-stance mods", () => {
    expect(isStanceMod({ type: "Melee" })).toBe(false)
    expect(isStanceMod({ type: "" })).toBe(false)
  })
})

describe("getModSetCode", () => {
  it("pulls the set segment out of a modSet path", () => {
    expect(
      getModSetCode({
        modSet: "/Lotus/Upgrades/Mods/Sets/Augur/AugurSetMod",
      }),
    ).toBe("Augur")
  })

  it("returns null when the mod isn't part of a set", () => {
    expect(getModSetCode({ modSet: undefined })).toBeNull()
  })

  it("returns null when the path has no /Sets/ segment", () => {
    // Defensive: a malformed path shouldn't crash the badge resolver.
    expect(
      getModSetCode({ modSet: "/Lotus/Upgrades/Mods/Warframe/Whatever" }),
    ).toBeNull()
  })
})

// The three Serration variants in the real catalog, plus an unrelated mod.
const SERRATION = "/Lotus/Upgrades/Mods/Rifle/WeaponDamageAmountMod"
const AMALGAM = "/Lotus/Upgrades/Mods/DualSource/Rifle/SerratedRushMod"
const SPECTRAL = "/Lotus/Upgrades/Mods/Rifle/WeaponDamageAmountInvisibleMod"
const POINT_STRIKE = "/Lotus/Upgrades/Mods/Rifle/WeaponCritChanceMod"
const CRIT_DELAY =
  "/Lotus/Upgrades/Mods/Rifle/DualStat/CorruptedCritRateFireRateRifle"

// Symmetric graph as the build pipeline emits it. Point Strike / Critical
// Delay form a second, independent conflict (both raise crit chance).
const CONFLICTS: ModConflictMap = {
  [SERRATION]: [AMALGAM, SPECTRAL],
  [AMALGAM]: [SERRATION, SPECTRAL],
  [SPECTRAL]: [SERRATION, AMALGAM],
  [POINT_STRIKE]: [CRIT_DELAY],
  [CRIT_DELAY]: [POINT_STRIKE],
}

describe("modsConflict", () => {
  it("is true for two variants of the same base mod", () => {
    expect(modsConflict(SERRATION, AMALGAM, CONFLICTS)).toBe(true)
  })

  it("is order-independent", () => {
    expect(modsConflict(AMALGAM, SERRATION, CONFLICTS)).toBe(true)
  })

  it("tolerates a one-sided map", () => {
    // Only the a→b edge present; modsConflict should still report it.
    expect(modsConflict(SERRATION, AMALGAM, { [SERRATION]: [AMALGAM] })).toBe(
      true,
    )
  })

  it("is false for unrelated mods and unknown mods", () => {
    expect(modsConflict(SERRATION, POINT_STRIKE, CONFLICTS)).toBe(false)
    expect(modsConflict("nope", "also-nope", CONFLICTS)).toBe(false)
  })
})

describe("getConflictingUniqueNames", () => {
  it("flags every placed mod that clashes with another placed mod", () => {
    const flagged = getConflictingUniqueNames(
      [SERRATION, AMALGAM, SPECTRAL, POINT_STRIKE],
      CONFLICTS,
    )
    // All three Serrations clash; lone Point Strike does not.
    expect(flagged).toEqual(new Set([SERRATION, AMALGAM, SPECTRAL]))
  })

  it("returns an empty set for a legal loadout", () => {
    expect(
      getConflictingUniqueNames([SERRATION, POINT_STRIKE], CONFLICTS),
    ).toEqual(new Set())
  })
})

describe("getBlockedByConflict", () => {
  it("returns the variants that conflict with placed mods, minus the placed ones", () => {
    const blocked = getBlockedByConflict([SERRATION], CONFLICTS)
    expect(blocked).toEqual(new Set([AMALGAM, SPECTRAL]))
  })

  it("excludes mods already placed", () => {
    const blocked = getBlockedByConflict([SERRATION, AMALGAM], CONFLICTS)
    // Both placed → only the still-unplaced Spectral is blockable.
    expect(blocked).toEqual(new Set([SPECTRAL]))
  })
})

describe("groupConflictingMods", () => {
  it("groups each independent conflict separately", () => {
    const groups = groupConflictingMods(
      [SERRATION, POINT_STRIKE, AMALGAM, CRIT_DELAY, SPECTRAL],
      CONFLICTS,
    )
    expect(groups).toHaveLength(2)
    // Components preserve input order: Serration group encountered first.
    expect(new Set(groups[0])).toEqual(new Set([SERRATION, AMALGAM, SPECTRAL]))
    expect(new Set(groups[1])).toEqual(new Set([POINT_STRIKE, CRIT_DELAY]))
  })

  it("returns no groups when nothing conflicts", () => {
    expect(groupConflictingMods([SERRATION, POINT_STRIKE], CONFLICTS)).toEqual(
      [],
    )
  })
})

describe("getAugmentAbility", () => {
  const aug = (desc: string, isAugment = true): Mod =>
    ({ levelStats: [{ stats: [desc] }], isAugment }) as Mod

  it("pulls the ability out of an '<Ability> Augment:' prefix", () => {
    expect(getAugmentAbility(aug("Decoy Augment: Decoy can be cast …"))).toBe(
      "Decoy",
    )
    expect(
      getAugmentAbility(aug("Switch Teleport Augment: Allies are protected …")),
    ).toBe("Switch Teleport")
  })

  it("tolerates a stray space before the colon", () => {
    // A few real augments read "Sol Gate Augment :" / "Blaze Artillery Augment :".
    expect(getAugmentAbility(aug("Sol Gate Augment : Wisp and 2 …"))).toBe(
      "Sol Gate",
    )
  })

  it("returns null for weapon augments (flat stat, no prefix)", () => {
    expect(getAugmentAbility(aug("+75% Damage"))).toBeNull()
    // Biting Frost augments Frost's passive and names no ability → no group.
    expect(
      getAugmentAbility(aug("Frost gains +130% Critical Chance …")),
    ).toBeNull()
  })

  it("returns null for non-augments", () => {
    expect(getAugmentAbility(aug("Decoy Augment: …", false))).toBeNull()
  })
})

describe("deriveAbilityAugmentConflicts", () => {
  const aug = (name: string, compatName: string, ability: string | null): Mod =>
    ({
      uniqueName: name,
      name,
      compatName,
      isAugment: true,
      levelStats: [{ stats: [ability ? `${ability} Augment: …` : "+50% Foo"] }],
    }) as Mod

  it("makes all augments of one ability mutually exclusive (Loki Decoy)", () => {
    const mods = [
      aug("DamageDecoy", "Loki", "Decoy"),
      aug("DeceptiveBond", "Loki", "Decoy"),
      aug("SaviorDecoy", "Loki", "Decoy"),
      aug("HushedInvis", "Loki", "Invisibility"), // different ability
    ]
    const m = deriveAbilityAugmentConflicts(mods)
    expect(m["DamageDecoy"]).toEqual(["DeceptiveBond", "SaviorDecoy"])
    expect(m["DeceptiveBond"]).toEqual(["DamageDecoy", "SaviorDecoy"])
    expect(m["SaviorDecoy"]).toEqual(["DamageDecoy", "DeceptiveBond"])
    // Invisibility augment is alone in its group → no conflict edge.
    expect(m["HushedInvis"]).toBeUndefined()
  })

  it("does not link same-ability-named augments across different frames", () => {
    // Two frames could share an ability display name; compatName keeps them apart.
    const mods = [
      aug("A", "Volt", "Discharge"),
      aug("B", "Excalibur", "Discharge"),
    ]
    expect(deriveAbilityAugmentConflicts(mods)).toEqual({})
  })

  it("ignores weapon augments (no '<Ability> Augment:' prefix)", () => {
    const mods = [aug("W1", "Tigris", null), aug("W2", "Tigris", null)]
    expect(deriveAbilityAugmentConflicts(mods)).toEqual({})
  })
})

describe("getModsForItem — tag refinement", () => {
  const mod = (over: Partial<Mod>): Mod =>
    ({
      uniqueName: over.name ?? "",
      name: "",
      compatName: "Rifle",
      ...over,
    }) as Mod

  // Real mods from the catalog.
  const serration = mod({ name: "Serration", compatName: "Rifle" })
  const splitFlights = mod({
    name: "Split Flights",
    compatName: "Bow",
    incompatTags: ["CRPBOW", "CROSSBOW", "GRNBOW", "INFBOW"],
  })
  const semiCannonade = mod({
    name: "Semi-Rifle Cannonade",
    compatName: "Rifle",
    compatTags: ["SEMI_AUTO"],
  })
  const thunderbolt = mod({ name: "Thunderbolt", compatName: "Bow" })
  const allMods = [serration, splitFlights, semiCannonade, thunderbolt]

  const namesFor = (item: Parameters<typeof getModsForItem>[0]) =>
    new Set(getModsForItem(item, allMods).map((m) => m.name))

  it("excludes incompatible-tag and missing-required-tag mods on the Kuva Bramma", () => {
    // Grineer bow: routes Rifle + Bow pools, tagged GRNBOW, NOT semi-auto.
    const bramma = {
      uniqueName: "/Lotus/Weapons/Grineer/Bows/GrnBow/GrnBowWeapon",
      modPools: ["Rifle", "Bow", "Kuva Bramma"],
      compatTags: ["PROJECTILE", "AOE", "SNIPER_AMMO", "SINGLESHOT", "GRNBOW"],
    }
    const names = namesFor(bramma)
    expect(names.has("Split Flights")).toBe(false) // incompat GRNBOW
    expect(names.has("Semi-Rifle Cannonade")).toBe(false) // needs SEMI_AUTO
    expect(names.has("Serration")).toBe(true) // plain Rifle mod
    expect(names.has("Thunderbolt")).toBe(true) // plain Bow mod, no GRNBOW excl.
  })

  it("keeps a SEMI_AUTO mod on a semi-auto rifle", () => {
    const latron = {
      uniqueName: "/Lotus/Weapons/Tenno/Rifle/Latron",
      modPools: ["Rifle"],
      compatTags: ["ASSAULT_AMMO", "SEMI_AUTO"],
    }
    expect(namesFor(latron).has("Semi-Rifle Cannonade")).toBe(true)
  })

  it("is permissive for weapons with no tag data and no trigger", () => {
    // Untagged weapon with no trigger → tag refinement skipped entirely, so
    // required-tag mods still show (we have nothing to decide against).
    const untagged = { uniqueName: "/Lotus/WikiOnly/Foo", modPools: ["Rifle"] }
    expect(namesFor(untagged).has("Semi-Rifle Cannonade")).toBe(true)
  })

  it("uses trigger to gate SEMI_AUTO/BEAM mods on PE+-untagged weapons", () => {
    // Furis: PE+ ships no compatTags, but its trigger (AUTO) is enough to rule
    // out a semi-auto-only mod and a beam-only mod — both leaked before.
    const furis = {
      uniqueName: "/Lotus/Weapons/Tenno/Pistol/AutoPistol",
      modPools: ["Pistol"],
      trigger: "AUTO",
    }
    const pistolMods = [
      mod({
        name: "Semi-Pistol Cannonade",
        compatName: "Pistol",
        compatTags: ["SEMI_AUTO"],
      }),
      mod({
        name: "Ruinous Extension",
        compatName: "Pistol",
        compatTags: ["BEAM"],
      }),
      mod({ name: "Hornet Strike", compatName: "Pistol" }),
      mod({
        name: "Heavy Warhead",
        compatName: "Pistol",
        compatTags: ["PROJECTILE"],
      }),
    ]
    const names = new Set(getModsForItem(furis, pistolMods).map((m) => m.name))
    expect(names.has("Semi-Pistol Cannonade")).toBe(false) // AUTO, not semi
    expect(names.has("Ruinous Extension")).toBe(false) // untagged ⇒ not beam
    expect(names.has("Hornet Strike")).toBe(true) // plain Pistol mod
    // PROJECTILE isn't decidable from trigger → stay permissive, don't hide it.
    expect(names.has("Heavy Warhead")).toBe(true)
  })

  it("keeps a SEMI_AUTO mod on a PE+-untagged semi-auto weapon via trigger", () => {
    // Vasto (SEMI) also lacks PE+ tags; the semi-only Cannonade must still show.
    const vasto = {
      uniqueName: "/Lotus/Weapons/Tenno/Pistols/Vasto",
      modPools: ["Pistol"],
      trigger: "SEMI",
    }
    const cannonade = mod({
      name: "Semi-Pistol Cannonade",
      compatName: "Pistol",
      compatTags: ["SEMI_AUTO"],
    })
    expect(getModsForItem(vasto, [cannonade]).map((m) => m.name)).toContain(
      "Semi-Pistol Cannonade",
    )
  })

  it("does not let the required-tag check hide stances from power/exalted weapons", () => {
    // Sword stances carry compatTags ["SWORDS_STANCE"] but exalted/power
    // weapons (Exalted Blade, Diwata, …) are tagged ["POWER_WEAPON"] and lack
    // it. Stances route by compatName, so they must still appear.
    const stance = mod({
      name: "Swooping Falcon",
      compatName: "Swords",
      type: "Stance",
      compatTags: ["SWORDS_STANCE"],
    })
    const exalted = {
      uniqueName: "/Lotus/Powersuits/Excalibur/ExaltedBlade",
      modPools: ["Melee", "Swords", "Exalted Blade"],
      compatTags: ["POWER_WEAPON", "NO_SLIDE"],
    }
    expect(getModsForItem(exalted, [stance]).map((m) => m.name)).toContain(
      "Swooping Falcon",
    )
  })
})
