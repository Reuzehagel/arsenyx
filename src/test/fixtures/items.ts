// Test fixtures for Warframe items
import type { Warframe, Gun, Melee, DamageTypes } from "@/lib/warframe/types"

/**
 * Excalibur - default test warframe
 */
export const EXCALIBUR: Warframe = {
  uniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
  name: "Excalibur",
  health: 100,
  shield: 100,
  armor: 225,
  power: 100,
  sprintSpeed: 1.0,
  tradable: false,
  polarities: ["madurai", "vazarin"],
  abilities: [
    {
      uniqueName: "/Lotus/Powersuits/Excalibur/SlashDash",
      name: "Slash Dash",
      description:
        "Dash between enemies while slashing with the Exalted Blade.",
    },
    {
      uniqueName: "/Lotus/Powersuits/Excalibur/RadialBlind",
      name: "Radial Blind",
      description:
        "Emits a bright flash of light, blinding all enemies in range.",
    },
    {
      uniqueName: "/Lotus/Powersuits/Excalibur/RadialJavelin",
      name: "Radial Javelin",
      description: "Launches javelins towards enemies, dealing high damage.",
    },
    {
      uniqueName: "/Lotus/Powersuits/Excalibur/ExaltedBlade",
      name: "Exalted Blade",
      description: "Summon a blade of pure light and immense power.",
    },
  ],
}

/**
 * Inaros - high health, no shields warframe for testing
 */
export const INAROS: Warframe = {
  uniqueName: "/Lotus/Powersuits/Sandman/Sandman",
  name: "Inaros",
  health: 550,
  shield: 0,
  armor: 200,
  power: 100,
  sprintSpeed: 1.0,
  tradable: false,
  polarities: ["naramon", "naramon"],
}

/**
 * Rhino - high armor warframe
 */
export const RHINO: Warframe = {
  uniqueName: "/Lotus/Powersuits/Rhino/Rhino",
  name: "Rhino",
  health: 100,
  shield: 150,
  armor: 190,
  power: 100,
  sprintSpeed: 0.95,
  tradable: false,
  polarities: ["madurai", "vazarin"],
}

/**
 * Braton - baseline assault rifle
 */
export const BRATON: Gun = {
  uniqueName: "/Lotus/Weapons/Tenno/LongGuns/Braton/Braton",
  name: "Braton",
  tradable: false,
  totalDamage: 20,
  fireRate: 8.75,
  criticalChance: 0.12,
  criticalMultiplier: 1.6,
  procChance: 0.06,
  accuracy: 28.6,
  magazineSize: 45,
  reloadTime: 2.0,
  damage: {
    impact: 7.9,
    puncture: 7.9,
    slash: 4.2,
  } as DamageTypes,
  polarities: [],
}

/**
 * Soma Prime - crit-focused rifle
 */
export const SOMA_PRIME: Gun = {
  uniqueName: "/Lotus/Weapons/Tenno/LongGuns/SomaPrime",
  name: "Soma Prime",
  isPrime: true,
  tradable: true,
  totalDamage: 12,
  fireRate: 15,
  criticalChance: 0.3,
  criticalMultiplier: 3.0,
  procChance: 0.1,
  accuracy: 28.6,
  magazineSize: 200,
  reloadTime: 3.0,
  damage: {
    impact: 1.2,
    puncture: 4.8,
    slash: 6,
  } as DamageTypes,
  polarities: ["madurai", "madurai", "vazarin"],
}

/**
 * Skana - basic melee weapon
 */
export const SKANA: Melee = {
  uniqueName: "/Lotus/Weapons/Tenno/Melee/LongSword/LongSword",
  name: "Skana",
  tradable: false,
  totalDamage: 42,
  fireRate: 0.833, // Attack speed
  criticalChance: 0.08,
  criticalMultiplier: 1.5,
  procChance: 0.1,
  range: 2.5,
  comboDuration: 5,
  damage: {
    impact: 8.4,
    puncture: 8.4,
    slash: 25.2,
  } as DamageTypes,
  polarities: [],
}
