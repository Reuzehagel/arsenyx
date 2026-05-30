import type {
  Attack,
  DamageTypes,
  Gun,
  ModularKitguns,
  Weapon,
} from "@arsenyx/shared/warframe/types"

type AnyWeapon = Gun | Weapon

/**
 * Reconstruct a kitgun chamber's stats from the selected grip + loader.
 *
 * DE ships kitgun chambers as zero-stat shells, so the catalog item carries no
 * real numbers (see packages/shared/.../kitgun-data.ts). The build emits the
 * wiki's verified per-combination tables to `/data/modular.json`; here we layer
 * the chosen grip (damage + fire rate) and loader (additive crit/status/multi,
 * magazine, reload) onto the chamber base, the same way `adjustStrikeForZaw`
 * reconstructs zaws.
 *
 * Crit/status are emitted as integer percents to match the catalog's attack
 * convention (`crit_chance: 35`); `normalizeRate` in the stat calculator
 * accepts either form. Returns the weapon unchanged when the data isn't loaded
 * yet or the chamber/grip isn't found.
 */
export function adjustChamberForKitgun<T extends AnyWeapon>(
  weapon: T,
  family: string,
  cls: "primary" | "secondary",
  gripName: string,
  loaderName: string,
  modular: ModularKitguns | undefined,
): T {
  if (!modular) return weapon
  const chamber = modular[cls]?.[family]
  if (!chamber) return weapon
  const grip = chamber.grips[gripName]
  if (!grip) return weapon
  // A gilded kitgun always has a loader, so this should always resolve; if it
  // somehow doesn't, the loader's additive terms fall to 0 and magazine/reload
  // keep the chamber's shell values (guarded below) rather than throwing.
  const loader = modular.loaders[loaderName]

  const critChance = (chamber.critChance + (loader?.critChance ?? 0)) * 100
  const critMult = chamber.critMultiplier + (loader?.critMultiplier ?? 0)
  const statusChance =
    (chamber.statusChance + (loader?.statusChance ?? 0)) * 100

  const damageByAttack = new Map<string, DamageTypes>(
    grip.attacks.map((a) => [a.name, a.damage]),
  )

  // Keep only the attack modes the grip supplies damage for. Modes with no
  // reconstructed value (bomblets, a chamber's separate explosion, or a grip
  // that zeroes the projectile) aren't in any verifiable source, so we drop
  // them rather than show a misleading 0.
  const adjustedAttacks: Attack[] = []
  for (const attack of weapon.attacks ?? []) {
    const damage = damageByAttack.get(attack.name)
    if (!damage) continue
    adjustedAttacks.push({
      ...attack,
      damage,
      crit_chance: critChance,
      crit_mult: critMult,
      status_chance: statusChance,
      speed: grip.fireRate,
    })
  }
  // If no catalog attack matched a reconstructed mode (e.g. an upstream
  // AttackName rename drifts from the chamber's catalog attacks), fall back to
  // the unchanged weapon rather than rendering a weapon with zero attacks.
  if (adjustedAttacks.length === 0) return weapon

  const adjusted: T = { ...weapon, attacks: adjustedAttacks }
  if (loader) {
    const magazine = chamber.magazine[loader.magazine]
    if (magazine !== undefined) (adjusted as Gun).magazineSize = magazine
    ;(adjusted as Gun).reloadTime = loader.reload
  }
  return adjusted
}
