// Shared stat calculation utilities and constants
// Used by both warframe-stats.ts and weapon-stats.ts

import { parseModStats } from "../stat-parser"
import type { ParsedStat } from "../stat-types"
import type { BuildState, PlacedMod, DamageTypes } from "../types"

// Umbral mod set tracking
export const UMBRAL_MODS = new Set([
  "Umbral Vitality",
  "Umbral Intensify",
  "Umbral Fiber",
])

// Auras that affect enemies rather than the player's stats.
// We exclude these from player stat calculations.
export const AURA_MODS_IGNORE_FOR_PLAYER_STATS = new Set<string>([
  "/Lotus/Upgrades/Mods/Aura/EnemyArmorReductionAuraMod", // Corrosive Projection
])

// Umbral set bonus multipliers based on count
export const UMBRAL_SET_BONUSES: Record<number, number> = {
  1: 1.0, // No bonus with 1 mod
  2: 1.25, // 25% bonus with 2 mods
  3: 1.75, // 75% bonus with 3 mods
}

/**
 * Get all placed mods from a build state
 */
export function getAllPlacedMods(buildState: BuildState): PlacedMod[] {
  const mods: PlacedMod[] = []

  // Aura slots
  for (const slot of buildState.auraSlots) {
    if (slot.mod && !AURA_MODS_IGNORE_FOR_PLAYER_STATS.has(slot.mod.uniqueName)) {
      mods.push(slot.mod)
    }
  }

  // Exilus slot
  if (buildState.exilusSlot?.mod) {
    mods.push(buildState.exilusSlot.mod)
  }

  // Normal slots
  for (const slot of buildState.normalSlots) {
    if (slot.mod) {
      mods.push(slot.mod)
    }
  }

  return mods
}

/**
 * Count Umbral mods in the build
 */
export function countUmbralMods(mods: PlacedMod[]): number {
  return mods.filter((m) => UMBRAL_MODS.has(m.name)).length
}

/**
 * Get the effective value of a parsed stat, considering max stacks
 */
export function getStatValue(stat: ParsedStat, showMaxStacks: boolean): number {
  if (stat.isConditional && showMaxStacks && stat.maxStacks) {
    return stat.value * stat.maxStacks
  }
  return stat.value
}

/**
 * Sum all damage types to get total damage
 */
export function sumDamageTypes(damage: DamageTypes): number {
  return Object.values(damage).reduce<number>((sum, val) => sum + (val ?? 0), 0)
}

/**
 * Check if a build has any conditional mods
 */
export function buildHasConditionalMods(buildState: BuildState): boolean {
  const mods = getAllPlacedMods(buildState)

  for (const mod of mods) {
    const parsedStats = parseModStats(mod)
    if (parsedStats.some((s) => s.isConditional)) {
      return true
    }
  }

  return false
}
