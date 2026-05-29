import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"

/**
 * Max rank a mod can be ranked to. `fusionLimit` is the upgrade cap from the
 * catalog; mods without one (synthetic / data gaps) clamp to 0.
 */
export function modMaxRank(mod: Mod): number {
  return mod.fusionLimit ?? 0
}

/**
 * Max rank an arcane can be ranked to. Arcanes with level data cap one below
 * their level-stat count (rank is 0-indexed); the rest default to 5.
 */
export function arcaneMaxRank(arcane: Arcane): number {
  return arcane.levelStats ? arcane.levelStats.length - 1 : 5
}
