// Zaw modular melee weapon data
// Strikes: base damage/crit/status/speed come from WFCD attacks array
// Grips & Links: hardcoded modifier tables (stable since Plains of Eidolon release)

import { sumDamageTypes } from "./stats/stat-engine"
import type { DamageTypes } from "./types"

export interface ZawStrike {
  name: string
  imageName: string
  oneHanded: string
  twoHanded: string
  twoHandedMultiplier: number
}

export interface ZawGrip {
  name: string
  imageName: string
  damage: number
  speed: number
  oneHanded: boolean
}

export interface ZawLink {
  name: string
  imageName: string
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

export const ZAW_STRIKES: ZawStrike[] = [
  { name: "Balla", imageName: "balla-75b70ce303.png", oneHanded: "Dagger", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Cyath", imageName: "cyath-1b8937730a.png", oneHanded: "Machete", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Dehtat", imageName: "dehtat-2f3f0ddaa6.png", oneHanded: "Rapier", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Dokrahm", imageName: "dokrahm-37b48a9e1e.png", oneHanded: "Scythe", twoHanded: "Heavy Blade", twoHandedMultiplier: 1.15 },
  { name: "Kronsh", imageName: "kronsh-f5ae3a6154.png", oneHanded: "Machete", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Mewan", imageName: "mewan-4c3f32889c.png", oneHanded: "Sword", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
  { name: "Ooltha", imageName: "ooltha-fbca7e140b.png", oneHanded: "Sword", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Rabvee", imageName: "rabvee-0a58ffb572.png", oneHanded: "Machete", twoHanded: "Hammer", twoHandedMultiplier: 1.15 },
  { name: "Sepfahn", imageName: "sepfahn-a6403cc3ff.png", oneHanded: "Nikana", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Plague Keewar", imageName: "plague-keewar-0492fb5b20.png", oneHanded: "Scythe", twoHanded: "Staff", twoHandedMultiplier: 1.09 },
  { name: "Plague Kripath", imageName: "plague-kripath-c0d8fea486.png", oneHanded: "Rapier", twoHanded: "Polearm", twoHandedMultiplier: 1.09 },
]

export const ZAW_GRIPS: ZawGrip[] = [
  { name: "Peye", imageName: "peye-c489dd9227.png", damage: 0, speed: 0, oneHanded: true },
  { name: "Laka", imageName: "laka-098b3b1be6.png", damage: -4, speed: 0.083, oneHanded: true },
  { name: "Kwath", imageName: "kwath-b513ea67e8.png", damage: 14, speed: -0.067, oneHanded: true },
  { name: "Plague Akwin", imageName: "plague-akwin-9002d44213.png", damage: 7, speed: 0, oneHanded: true },
  { name: "Jayap", imageName: "jayap-3aae844297.png", damage: 0, speed: 0, oneHanded: false },
  { name: "Seekalla", imageName: "seekalla-d8b757e408.png", damage: -4, speed: 0.083, oneHanded: false },
  { name: "Kroostra", imageName: "kroostra-e74bcfc2ca.png", damage: 28, speed: -0.067, oneHanded: false },
  { name: "Shtung", imageName: "shtung-66796b519a.png", damage: 14, speed: -0.033, oneHanded: false },
  { name: "Korb", imageName: "korb-f2a7529b43.png", damage: 7, speed: -0.033, oneHanded: false },
  { name: "Plague Bokwin", imageName: "plague-bokwin-ad3a2b7d7e.png", damage: 7, speed: 0, oneHanded: false },
]

export const ZAW_LINKS: ZawLink[] = [
  { name: "Jai", imageName: "jai-7a47884ee7.png", damage: -4, speed: 0.083, crit: 0, status: 0 },
  { name: "Jai II", imageName: "jai-ii-a41b8b50ea.png", damage: -8, speed: 0.167, crit: 0, status: 0 },
  { name: "Ruhang", imageName: "ruhang-8c9076606f.png", damage: 14, speed: -0.067, crit: 0, status: 0 },
  { name: "Ruhang II", imageName: "ruhang-ii-7aec53bcfb.png", damage: 28, speed: -0.133, crit: 0, status: 0 },
  { name: "Vargeet Jai", imageName: "vargeet-jai-fb8680a3ed.png", damage: -4, speed: 0.083, crit: 7, status: 0 },
  { name: "Vargeet Ruhang", imageName: "vargeet-ruhang-df37a83490.png", damage: 14, speed: -0.067, crit: 7, status: 0 },
  { name: "Vargeet II Jai", imageName: "vargeet-ii-jai-f92b870e32.png", damage: -4, speed: 0.083, crit: 14, status: 0 },
  { name: "Vargeet II Ruhang", imageName: "vargeet-ii-ruhang-55b5f0ac91.png", damage: 14, speed: -0.067, crit: 14, status: 0 },
  { name: "Vargeet Jai II", imageName: "vargeet-jai-ii-c27048f259.png", damage: -8, speed: 0.167, crit: 7, status: 0 },
  { name: "Vargeet Ruhang II", imageName: "vargeet-ruhang-ii-a934774072.png", damage: 28, speed: -0.133, crit: 7, status: 0 },
  { name: "Ekwana Jai", imageName: "ekwana-jai-5dd1e0aabe.png", damage: -4, speed: 0.083, crit: 0, status: 7 },
  { name: "Ekwana Ruhang", imageName: "ekwana-ruhang-47efe1fcbb.png", damage: 14, speed: -0.067, crit: 0, status: 7 },
  { name: "Ekwana II Jai", imageName: "ekwana-ii-jai-c5361c4620.png", damage: -4, speed: 0.083, crit: 0, status: 14 },
  { name: "Ekwana II Ruhang", imageName: "ekwana-ii-ruhang-263840a491.png", damage: 14, speed: -0.067, crit: 0, status: 14 },
  { name: "Ekwana Jai II", imageName: "ekwana-jai-ii-7cdd0a08c0.png", damage: -8, speed: 0.167, crit: 0, status: 7 },
  { name: "Ekwana Ruhang II", imageName: "ekwana-ruhang-ii-5e40256eb9.png", damage: 28, speed: -0.133, crit: 0, status: 7 },
]

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

export function getZawComponentImage(name: string): string | undefined {
  return (
    strikeMap.get(name)?.imageName ??
    gripMap.get(name)?.imageName ??
    linkMap.get(name)?.imageName
  )
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

export interface ZawBaseStatsInput {
  strikeAttack: {
    damage?: DamageTypes | string
    crit_chance?: number
    crit_mult?: number
    status_chance?: number
    speed?: number
  }
  strikeName: string
  gripName: string
  linkName: string
}

export function calculateZawBaseStats({
  strikeAttack,
  strikeName,
  gripName,
  linkName,
}: ZawBaseStatsInput): ZawBaseStats {
  const grip = gripMap.get(gripName)
  const link = linkMap.get(linkName)
  const strike = strikeMap.get(strikeName)
  const isTwoHanded = grip ? !grip.oneHanded : false

  const baseDamage =
    typeof strikeAttack.damage === "object" && strikeAttack.damage
      ? strikeAttack.damage
      : {}

  const baseTotalDamage = sumDamageTypes(baseDamage)

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

  return {
    totalDamage,
    damageTypes: scaledDamageTypes,
    critChance: (strikeAttack.crit_chance ?? 0) + (link?.crit ?? 0),
    critMult: strikeAttack.crit_mult ?? 2,
    statusChance:
      (strikeAttack.status_chance ?? 0) + (link?.status ?? 0),
    speed:
      (strikeAttack.speed ?? 1) + (grip?.speed ?? 0) + (link?.speed ?? 0),
    weaponType: getZawWeaponType(strikeName, gripName) ?? "Melee",
  }
}
