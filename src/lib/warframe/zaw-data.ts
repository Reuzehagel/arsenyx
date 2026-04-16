// Zaw modular melee weapon data
// Strikes: base stats come from WFCD attacks array
// Grips & Links: hardcoded modifier tables (stable since Plains of Eidolon release)

import type { DamageTypes } from "./types"

// =============================================================================
// TYPES
// =============================================================================

export interface ZawStrike {
  name: string
  oneHanded: string
  twoHanded: string
  twoHandedMultiplier: number
}

export interface ZawGrip {
  name: string
  damage: number
  speed: number
  oneHanded: boolean
}

export interface ZawLink {
  name: string
  crit: number
  status: number
  damage: number
  speed: number
}

export interface ZawBaseStats {
  totalDamage: number
  damageTypes: DamageTypes
  critChance: number
  critMult: number
  statusChance: number
  speed: number
  weaponType: string
}

// =============================================================================
// DATA TABLES
// =============================================================================

export const ZAW_STRIKES: ZawStrike[] = [
  { name: "Balla", oneHanded: "Dagger", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Cyath", oneHanded: "Machete", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Dehtat", oneHanded: "Rapier", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Dokrahm", oneHanded: "Scythe", twoHanded: "Heavy Blade", twoHandedMultiplier: 1.15 },
  { name: "Kronsh", oneHanded: "Machete", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Mewan", oneHanded: "Sword", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Ooltha", oneHanded: "Sword", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Rabvee", oneHanded: "Machete", twoHanded: "Hammer", twoHandedMultiplier: 1.15 },
  { name: "Sepfahn", oneHanded: "Nikana", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Plague Keewar", oneHanded: "Scythe", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Plague Kripath", oneHanded: "Rapier", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
]

export const ZAW_GRIPS: ZawGrip[] = [
  { name: "Peye", damage: 0, speed: 0, oneHanded: true },
  { name: "Laka", damage: -4, speed: 0.083, oneHanded: true },
  { name: "Kwath", damage: 14, speed: -0.067, oneHanded: true },
  { name: "Plague Akwin", damage: 7, speed: 0, oneHanded: true },
  { name: "Jayap", damage: 0, speed: 0, oneHanded: false },
  { name: "Seekalla", damage: -4, speed: 0.083, oneHanded: false },
  { name: "Kroostra", damage: 28, speed: -0.067, oneHanded: false },
  { name: "Shtung", damage: 14, speed: -0.033, oneHanded: false },
  { name: "Korb", damage: 7, speed: -0.033, oneHanded: false },
  { name: "Plague Bokwin", damage: 7, speed: 0, oneHanded: false },
]

export const ZAW_LINKS: ZawLink[] = [
  { name: "Jai", damage: -4, speed: 0.083, crit: 0, status: 0 },
  { name: "Jai Ii", damage: -8, speed: 0.167, crit: 0, status: 0 },
  { name: "Ruhang", damage: 14, speed: -0.067, crit: 0, status: 0 },
  { name: "Ruhang Ii", damage: 28, speed: -0.133, crit: 0, status: 0 },
  { name: "Vargeet Jai", damage: -4, speed: 0.083, crit: 7, status: 0 },
  { name: "Vargeet Ruhang", damage: 14, speed: -0.067, crit: 7, status: 0 },
  { name: "Vargeet Ii Jai", damage: -4, speed: 0.083, crit: 14, status: 0 },
  { name: "Vargeet Ii Ruhang", damage: 14, speed: -0.067, crit: 14, status: 0 },
  { name: "Vargeet Jai Ii", damage: -8, speed: 0.167, crit: 7, status: 0 },
  { name: "Vargeet Ruhang Ii", damage: 28, speed: -0.133, crit: 7, status: 0 },
  { name: "Ekwana Jai", damage: -4, speed: 0.083, crit: 0, status: 7 },
  { name: "Ekwana Ruhang", damage: 14, speed: -0.067, crit: 0, status: 7 },
  { name: "Ekwana Ii Jai", damage: -4, speed: 0.083, crit: 0, status: 14 },
  { name: "Ekwana Ii Ruhang", damage: 14, speed: -0.067, crit: 0, status: 14 },
  { name: "Ekwana Jai Ii", damage: -8, speed: 0.167, crit: 0, status: 7 },
  { name: "Ekwana Ruhang Ii", damage: 28, speed: -0.133, crit: 0, status: 7 },
]

// =============================================================================
// LOOKUP HELPERS
// =============================================================================

const strikeMap = new Map(ZAW_STRIKES.map((s) => [s.name, s]))
const gripMap = new Map(ZAW_GRIPS.map((g) => [g.name, g]))
const linkMap = new Map(ZAW_LINKS.map((l) => [l.name, l]))

export function isZawStrike(name: string): boolean {
  return strikeMap.has(name)
}

export function isZawGrip(name: string): boolean {
  return gripMap.has(name)
}

export function isZawLink(name: string): boolean {
  return linkMap.has(name)
}

export function getZawStrike(name: string): ZawStrike | undefined {
  return strikeMap.get(name)
}

export function getZawGrip(name: string): ZawGrip | undefined {
  return gripMap.get(name)
}

export function getZawLink(name: string): ZawLink | undefined {
  return linkMap.get(name)
}

export function getZawWeaponType(
  strikeName: string,
  gripName: string,
): string | null {
  const strike = strikeMap.get(strikeName)
  const grip = gripMap.get(gripName)
  if (!strike || !grip) return null
  return grip.oneHanded ? strike.oneHanded : strike.twoHanded
}

export function calculateZawBaseStats(
  strikeAttack: {
    damage?: DamageTypes | string
    crit_chance?: number
    crit_mult?: number
    status_chance?: number
    speed?: number
  },
  gripName: string,
  linkName: string,
  isTwoHanded: boolean,
  strikeName: string,
): ZawBaseStats {
  const grip = gripMap.get(gripName)
  const link = linkMap.get(linkName)
  const strike = strikeMap.get(strikeName)

  const baseDamage =
    typeof strikeAttack.damage === "object" && strikeAttack.damage
      ? strikeAttack.damage
      : {}

  const baseTotalDamage = Object.values(baseDamage).reduce(
    (sum: number, v) => sum + (typeof v === "number" ? v : 0),
    0,
  )

  let totalDamage =
    baseTotalDamage + (grip?.damage ?? 0) + (link?.damage ?? 0)

  if (isTwoHanded && strike) {
    totalDamage *= strike.twoHandedMultiplier
  }

  const damageScale = baseTotalDamage > 0 ? totalDamage / baseTotalDamage : 1
  const scaledDamageTypes: DamageTypes = {}
  for (const [key, value] of Object.entries(baseDamage)) {
    if (typeof value === "number") {
      scaledDamageTypes[key as keyof DamageTypes] = value * damageScale
    }
  }

  const weaponType =
    getZawWeaponType(strikeName, gripName) ?? "Melee"

  return {
    totalDamage,
    damageTypes: scaledDamageTypes,
    critChance: (strikeAttack.crit_chance ?? 0) + (link?.crit ?? 0),
    critMult: strikeAttack.crit_mult ?? 2,
    statusChance:
      (strikeAttack.status_chance ?? 0) + (link?.status ?? 0),
    speed:
      (strikeAttack.speed ?? 1) + (grip?.speed ?? 0) + (link?.speed ?? 0),
    weaponType,
  }
}
