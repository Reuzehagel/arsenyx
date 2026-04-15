// Test fixtures for mods
import type { PlacedMod, Polarity, RivenStats } from "@/lib/warframe/types"

/**
 * Create a test mod with default values
 */
export function createTestMod(overrides: Partial<PlacedMod> = {}): PlacedMod {
  return {
    uniqueName: "/Lotus/Upgrades/Mods/Test/TestMod",
    name: "Test Mod",
    polarity: "madurai" as Polarity,
    baseDrain: 4,
    fusionLimit: 5,
    rank: 5,
    rarity: "Common",
    ...overrides,
  }
}

// Common warframe mods
export const VITALITY: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarHealthMaxMod",
  name: "Vitality",
  polarity: "vazarin",
  baseDrain: 2,
  fusionLimit: 10,
  rank: 10,
  rarity: "Common",
  levelStats: [
    { stats: ["+40% Health"] },
    { stats: ["+80% Health"] },
    { stats: ["+120% Health"] },
    { stats: ["+160% Health"] },
    { stats: ["+200% Health"] },
    { stats: ["+240% Health"] },
    { stats: ["+280% Health"] },
    { stats: ["+320% Health"] },
    { stats: ["+360% Health"] },
    { stats: ["+400% Health"] },
    { stats: ["+440% Health"] },
  ],
})

export const STEEL_FIBER: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarArmorMaxMod",
  name: "Steel Fiber",
  polarity: "vazarin",
  baseDrain: 2,
  fusionLimit: 10,
  rank: 10,
  rarity: "Common",
  levelStats: [
    { stats: ["+10% Armor"] },
    { stats: ["+20% Armor"] },
    { stats: ["+30% Armor"] },
    { stats: ["+40% Armor"] },
    { stats: ["+50% Armor"] },
    { stats: ["+60% Armor"] },
    { stats: ["+70% Armor"] },
    { stats: ["+80% Armor"] },
    { stats: ["+90% Armor"] },
    { stats: ["+100% Armor"] },
    { stats: ["+110% Armor"] },
  ],
})

export const INTENSIFY: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarPowerStrengthMod",
  name: "Intensify",
  polarity: "madurai",
  baseDrain: 4,
  fusionLimit: 5,
  rank: 5,
  rarity: "Rare",
  levelStats: [
    { stats: ["+5% Ability Strength"] },
    { stats: ["+10% Ability Strength"] },
    { stats: ["+15% Ability Strength"] },
    { stats: ["+20% Ability Strength"] },
    { stats: ["+25% Ability Strength"] },
    { stats: ["+30% Ability Strength"] },
  ],
})

export const UMBRAL_VITALITY: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Warframe/Expert/AvatarUmbralHealthMod",
  name: "Umbral Vitality",
  polarity: "umbra",
  baseDrain: 2,
  fusionLimit: 10,
  rank: 10,
  rarity: "Legendary",
  modSet: "Umbra",
  levelStats: [
    { stats: ["+55% Health", "+11% Tau Resistance"] },
    { stats: ["+110% Health", "+22% Tau Resistance"] },
    { stats: ["+165% Health", "+33% Tau Resistance"] },
    { stats: ["+220% Health", "+44% Tau Resistance"] },
    { stats: ["+275% Health", "+55% Tau Resistance"] },
    { stats: ["+330% Health", "+66% Tau Resistance"] },
    { stats: ["+385% Health", "+77% Tau Resistance"] },
    { stats: ["+440% Health", "+88% Tau Resistance"] },
    { stats: ["+495% Health", "+99% Tau Resistance"] },
    { stats: ["+550% Health", "+110% Tau Resistance"] },
    { stats: ["+605% Health", "+121% Tau Resistance"] },
  ],
})

export const UMBRAL_INTENSIFY: PlacedMod = createTestMod({
  uniqueName:
    "/Lotus/Upgrades/Mods/Warframe/Expert/AvatarUmbralPowerStrengthMod",
  name: "Umbral Intensify",
  polarity: "umbra",
  baseDrain: 4,
  fusionLimit: 10,
  rank: 10,
  rarity: "Legendary",
  modSet: "Umbra",
  levelStats: [
    { stats: ["+11% Ability Strength"] },
    { stats: ["+22% Ability Strength"] },
    { stats: ["+33% Ability Strength"] },
    { stats: ["+44% Ability Strength"] },
    { stats: ["+55% Ability Strength"] },
    { stats: ["+66% Ability Strength"] },
    { stats: ["+77% Ability Strength"] },
    { stats: ["+88% Ability Strength"] },
    { stats: ["+99% Ability Strength"] },
    { stats: ["+110% Ability Strength"] },
    { stats: ["+121% Ability Strength"] },
  ],
})

export const UMBRAL_FIBER: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Warframe/Expert/AvatarUmbralArmorMod",
  name: "Umbral Fiber",
  polarity: "umbra",
  baseDrain: 2,
  fusionLimit: 10,
  rank: 10,
  rarity: "Legendary",
  modSet: "Umbra",
  levelStats: [
    { stats: ["+16.5% Armor", "+11% Tau Resistance"] },
    { stats: ["+33% Armor", "+22% Tau Resistance"] },
    { stats: ["+49.5% Armor", "+33% Tau Resistance"] },
    { stats: ["+66% Armor", "+44% Tau Resistance"] },
    { stats: ["+82.5% Armor", "+55% Tau Resistance"] },
    { stats: ["+99% Armor", "+66% Tau Resistance"] },
    { stats: ["+115.5% Armor", "+77% Tau Resistance"] },
    { stats: ["+132% Armor", "+88% Tau Resistance"] },
    { stats: ["+148.5% Armor", "+99% Tau Resistance"] },
    { stats: ["+165% Armor", "+110% Tau Resistance"] },
    { stats: ["+181.5% Armor", "+121% Tau Resistance"] },
  ],
})

// Aura mod
export const STEEL_CHARGE: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Aura/PlayerMeleeDamageAuraMod",
  name: "Steel Charge",
  polarity: "madurai",
  baseDrain: -4, // Auras have negative drain (give capacity)
  fusionLimit: 5,
  rank: 5,
  rarity: "Uncommon",
  compatName: "Aura",
  levelStats: [
    { stats: ["+10% Melee Damage"] },
    { stats: ["+20% Melee Damage"] },
    { stats: ["+30% Melee Damage"] },
    { stats: ["+40% Melee Damage"] },
    { stats: ["+50% Melee Damage"] },
    { stats: ["+60% Melee Damage"] },
  ],
})

// Weapon mods
export const SERRATION: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Rifle/DamageMod",
  name: "Serration",
  polarity: "madurai",
  baseDrain: 4,
  fusionLimit: 10,
  rank: 10,
  rarity: "Uncommon",
  compatName: "Rifle",
  levelStats: [
    { stats: ["+15% Damage"] },
    { stats: ["+30% Damage"] },
    { stats: ["+45% Damage"] },
    { stats: ["+60% Damage"] },
    { stats: ["+75% Damage"] },
    { stats: ["+90% Damage"] },
    { stats: ["+105% Damage"] },
    { stats: ["+120% Damage"] },
    { stats: ["+135% Damage"] },
    { stats: ["+150% Damage"] },
    { stats: ["+165% Damage"] },
  ],
})

export const POINT_STRIKE: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Rifle/CritChanceMod",
  name: "Point Strike",
  polarity: "madurai",
  baseDrain: 2,
  fusionLimit: 5,
  rank: 5,
  rarity: "Common",
  compatName: "Rifle",
  levelStats: [
    { stats: ["+25% Critical Chance"] },
    { stats: ["+50% Critical Chance"] },
    { stats: ["+75% Critical Chance"] },
    { stats: ["+100% Critical Chance"] },
    { stats: ["+125% Critical Chance"] },
    { stats: ["+150% Critical Chance"] },
  ],
})

export const VITAL_SENSE: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Rifle/CritDamageMod",
  name: "Vital Sense",
  polarity: "madurai",
  baseDrain: 2,
  fusionLimit: 5,
  rank: 5,
  rarity: "Rare",
  compatName: "Rifle",
  levelStats: [
    { stats: ["+20% Critical Multiplier"] },
    { stats: ["+40% Critical Multiplier"] },
    { stats: ["+60% Critical Multiplier"] },
    { stats: ["+80% Critical Multiplier"] },
    { stats: ["+100% Critical Multiplier"] },
    { stats: ["+120% Critical Multiplier"] },
  ],
})

export const HELLFIRE: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Rifle/FireDamageMod",
  name: "Hellfire",
  polarity: "naramon",
  baseDrain: 4,
  fusionLimit: 5,
  rank: 5,
  rarity: "Uncommon",
  compatName: "Rifle",
  levelStats: [
    { stats: ["+15% <DT_HEAT_COLOR>Heat"] },
    { stats: ["+30% <DT_HEAT_COLOR>Heat"] },
    { stats: ["+45% <DT_HEAT_COLOR>Heat"] },
    { stats: ["+60% <DT_HEAT_COLOR>Heat"] },
    { stats: ["+75% <DT_HEAT_COLOR>Heat"] },
    { stats: ["+90% <DT_HEAT_COLOR>Heat"] },
  ],
})

export const STORMBRINGER: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Rifle/ElectricDamageMod",
  name: "Stormbringer",
  polarity: "naramon",
  baseDrain: 4,
  fusionLimit: 5,
  rank: 5,
  rarity: "Uncommon",
  compatName: "Rifle",
  levelStats: [
    { stats: ["+15% <DT_ELECTRICITY_COLOR>Electricity"] },
    { stats: ["+30% <DT_ELECTRICITY_COLOR>Electricity"] },
    { stats: ["+45% <DT_ELECTRICITY_COLOR>Electricity"] },
    { stats: ["+60% <DT_ELECTRICITY_COLOR>Electricity"] },
    { stats: ["+75% <DT_ELECTRICITY_COLOR>Electricity"] },
    { stats: ["+90% <DT_ELECTRICITY_COLOR>Electricity"] },
  ],
})

// Galvanized (conditional) mod
export const GALVANIZED_CHAMBER: PlacedMod = createTestMod({
  uniqueName: "/Lotus/Upgrades/Mods/Rifle/Expert/RifleMultishotGalvanizedMod",
  name: "Galvanized Chamber",
  polarity: "madurai",
  baseDrain: 6,
  fusionLimit: 10,
  rank: 10,
  rarity: "Legendary",
  compatName: "Rifle",
  levelStats: [
    {
      stats: [
        "+20% Multishot",
        "On Kill:\n+10% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+40% Multishot",
        "On Kill:\n+20% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+60% Multishot",
        "On Kill:\n+30% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+80% Multishot",
        "On Kill:\n+40% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+100% Multishot",
        "On Kill:\n+50% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+110% Multishot",
        "On Kill:\n+55% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+120% Multishot",
        "On Kill:\n+60% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+130% Multishot",
        "On Kill:\n+65% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+140% Multishot",
        "On Kill:\n+70% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+150% Multishot",
        "On Kill:\n+75% Multishot for 20s. Stacks up to 4x.",
      ],
    },
    {
      stats: [
        "+160% Multishot",
        "On Kill:\n+80% Multishot for 20s. Stacks up to 4x.",
      ],
    },
  ],
})

// Riven mod
export const RIVEN_MOD: PlacedMod = createTestMod({
  uniqueName: "/riven",
  name: "Riven Mod",
  polarity: "madurai",
  baseDrain: 18,
  fusionLimit: 8,
  rank: 8,
  rarity: "Riven",
  rivenStats: {
    positives: [
      { stat: "Critical Chance", value: 152.3 },
      { stat: "Multishot", value: 89.1 },
    ],
    negatives: [
      { stat: "Zoom", value: -40.5 },
    ],
  } satisfies RivenStats,
})
