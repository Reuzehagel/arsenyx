// Zaw modular melee weapon data.
// Strikes provide base damage/crit/status/speed via each item's attacks array.
// Grip and Link modifier tables are hardcoded (stable since Plains of Eidolon).

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

export const ZAW_STRIKES: ZawStrike[] = [
  {
    name: "Balla",
    imageName: "TipOne.png",
    oneHanded: "Dagger",
    twoHanded: "Staff",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Cyath",
    imageName: "TipFour.png",
    oneHanded: "Machete",
    twoHanded: "Polearm",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Dehtat",
    imageName: "TipFive.png",
    oneHanded: "Rapier",
    twoHanded: "Polearm",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Dokrahm",
    imageName: "TipEleven.png",
    oneHanded: "Scythe",
    twoHanded: "Heavy Blade",
    twoHandedMultiplier: 1.15,
  },
  {
    name: "Kronsh",
    imageName: "TipSix.png",
    oneHanded: "Machete",
    twoHanded: "Polearm",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Mewan",
    imageName: "TipThree.png",
    oneHanded: "Sword",
    twoHanded: "Polearm",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Ooltha",
    imageName: "TipTwo.png",
    oneHanded: "Sword",
    twoHanded: "Staff",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Rabvee",
    imageName: "TipTen.png",
    oneHanded: "Machete",
    twoHanded: "Hammer",
    twoHandedMultiplier: 1.15,
  },
  {
    name: "Sepfahn",
    imageName: "TipNine.png",
    oneHanded: "Nikana",
    twoHanded: "Staff",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Plague Keewar",
    imageName: "InfestedTipTwo.png",
    oneHanded: "Scythe",
    twoHanded: "Staff",
    twoHandedMultiplier: 1.09,
  },
  {
    name: "Plague Kripath",
    imageName: "InfestedTipOne.png",
    oneHanded: "Rapier",
    twoHanded: "Polearm",
    twoHandedMultiplier: 1.09,
  },
]

export const ZAW_GRIPS: ZawGrip[] = [
  {
    name: "Peye",
    imageName: "HandleOne.png",
    damage: 0,
    speed: 0,
    oneHanded: true,
  },
  {
    name: "Laka",
    imageName: "HandleTwo.png",
    damage: -4,
    speed: 0.083,
    oneHanded: true,
  },
  {
    name: "Kwath",
    imageName: "HandleThree.png",
    damage: 14,
    speed: -0.067,
    oneHanded: true,
  },
  {
    name: "Plague Akwin",
    imageName: "InfestedHandleOne.png",
    damage: 7,
    speed: 0,
    oneHanded: true,
  },
  {
    name: "Jayap",
    imageName: "HandleFive.png",
    damage: 0,
    speed: 0,
    oneHanded: false,
  },
  {
    name: "Seekalla",
    imageName: "HandleFour.png",
    damage: -4,
    speed: 0.083,
    oneHanded: false,
  },
  {
    name: "Kroostra",
    imageName: "HandleSix.png",
    damage: 28,
    speed: -0.067,
    oneHanded: false,
  },
  {
    name: "Shtung",
    imageName: "HandleTen.png",
    damage: 14,
    speed: -0.033,
    oneHanded: false,
  },
  {
    name: "Korb",
    imageName: "HandleNine.png",
    damage: 7,
    speed: -0.033,
    oneHanded: false,
  },
  {
    name: "Plague Bokwin",
    imageName: "InfestedHandleTwo.png",
    damage: 7,
    speed: 0,
    oneHanded: false,
  },
]

export const ZAW_LINKS: ZawLink[] = [
  {
    name: "Jai",
    imageName: "BalanceSpeedI.png",
    damage: -4,
    speed: 0.083,
    crit: 0,
    status: 0,
  },
  {
    name: "Jai II",
    imageName: "BalanceSpeedII.png",
    damage: -8,
    speed: 0.167,
    crit: 0,
    status: 0,
  },
  {
    name: "Ruhang",
    imageName: "BalanceDamageI.png",
    damage: 14,
    speed: -0.067,
    crit: 0,
    status: 0,
  },
  {
    name: "Ruhang II",
    imageName: "BalanceDamageII.png",
    damage: 28,
    speed: -0.133,
    crit: 0,
    status: 0,
  },
  {
    name: "Vargeet Jai",
    imageName: "BalanceSpeedICritI.png",
    damage: -4,
    speed: 0.083,
    crit: 7,
    status: 0,
  },
  {
    name: "Vargeet Ruhang",
    imageName: "BalanceDamageICritI.png",
    damage: 14,
    speed: -0.067,
    crit: 7,
    status: 0,
  },
  {
    name: "Vargeet II Jai",
    imageName: "BalanceSpeedICritII.png",
    damage: -4,
    speed: 0.083,
    crit: 14,
    status: 0,
  },
  {
    name: "Vargeet II Ruhang",
    imageName: "BalanceDamageICritII.png",
    damage: 14,
    speed: -0.067,
    crit: 14,
    status: 0,
  },
  {
    name: "Vargeet Jai II",
    imageName: "BalanceSpeedIICritI.png",
    damage: -8,
    speed: 0.167,
    crit: 7,
    status: 0,
  },
  {
    name: "Vargeet Ruhang II",
    imageName: "BalanceDamageIICritI.png",
    damage: 28,
    speed: -0.133,
    crit: 7,
    status: 0,
  },
  {
    name: "Ekwana Jai",
    imageName: "BalanceSpeedIStatusI.png",
    damage: -4,
    speed: 0.083,
    crit: 0,
    status: 7,
  },
  {
    name: "Ekwana Ruhang",
    imageName: "BalanceDamageIStatusI.png",
    damage: 14,
    speed: -0.067,
    crit: 0,
    status: 7,
  },
  {
    name: "Ekwana II Jai",
    imageName: "BalanceSpeedIStatusII.png",
    damage: -4,
    speed: 0.083,
    crit: 0,
    status: 14,
  },
  {
    name: "Ekwana II Ruhang",
    imageName: "BalanceDamageIStatusII.png",
    damage: 14,
    speed: -0.067,
    crit: 0,
    status: 14,
  },
  {
    name: "Ekwana Jai II",
    imageName: "BalanceSpeedIIStatusI.png",
    damage: -8,
    speed: 0.167,
    crit: 0,
    status: 7,
  },
  {
    name: "Ekwana Ruhang II",
    imageName: "BalanceDamageIIStatusI.png",
    damage: 28,
    speed: -0.133,
    crit: 0,
    status: 7,
  },
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

export const ZAW_DEFAULT_GRIP = "Jayap"
export const ZAW_DEFAULT_LINK = "Jai"
