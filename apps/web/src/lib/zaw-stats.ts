import type {
  Attack,
  DamageTypes,
  Gun,
  Melee,
  Weapon,
} from "@arsenyx/shared/warframe/types"
import {
  getZawGrip,
  getZawLink,
  getZawStrike,
} from "@arsenyx/shared/warframe/zaw-data"

import { sumDamage } from "./stats/weapon"

type AnyWeapon = Gun | Melee | Weapon

function adjustAttack(
  attack: Attack,
  strikeName: string,
  gripName: string,
  linkName: string,
): Attack {
  const strike = getZawStrike(strikeName)
  const grip = getZawGrip(gripName)
  const link = getZawLink(linkName)
  if (!strike || !grip || !link) return attack

  const isTwoHanded = !grip.oneHanded
  const baseDamage: DamageTypes =
    typeof attack.damage === "object" && attack.damage ? attack.damage : {}
  const baseTotal = sumDamage(baseDamage)

  let totalDamage = baseTotal + grip.damage + link.damage
  if (isTwoHanded) totalDamage *= strike.twoHandedMultiplier

  const scale = baseTotal > 0 ? totalDamage / baseTotal : 1
  const scaledDamage: DamageTypes = {}
  for (const [key, value] of Object.entries(baseDamage)) {
    if (typeof value === "number") {
      scaledDamage[key as keyof DamageTypes] = value * scale
    }
  }

  return {
    ...attack,
    damage: scaledDamage,
    crit_chance: (attack.crit_chance ?? 0) + link.crit,
    status_chance: (attack.status_chance ?? 0) + link.status,
    speed: (attack.speed ?? 1) + grip.speed + link.speed,
  }
}

export function adjustStrikeForZaw<T extends AnyWeapon>(
  weapon: T,
  strikeName: string,
  gripName: string,
  linkName: string,
): T {
  if (!weapon.attacks || weapon.attacks.length === 0) return weapon
  const adjustedAttacks = weapon.attacks.map((a) =>
    adjustAttack(a, strikeName, gripName, linkName),
  )
  return { ...weapon, attacks: adjustedAttacks }
}
