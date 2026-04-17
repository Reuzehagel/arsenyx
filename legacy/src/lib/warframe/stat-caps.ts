// Stat cap definitions and enforcement for Warframe stats

import type { StatType } from "./stat-types"

// Cap definition with optional min and max
interface StatCap {
  min?: number
  max?: number
}

// Stat caps based on Warframe game mechanics
// These are percentage-based for ability stats (100 = base)
export const STAT_CAPS: Partial<Record<StatType, StatCap>> = {
  // Ability Efficiency: Cannot reduce cost below 25% (175% efficiency)
  // or increase cost above 400% (min efficiency)
  ability_efficiency: { min: 25, max: 175 },

  // Ability Duration: Has a minimum of 12.5%
  ability_duration: { min: 12.5 },

  // Ability Range: Has a minimum of 34%
  ability_range: { min: 34 },
}

// Result of applying a stat cap
export interface CappedStatResult {
  value: number // The capped value (or original if no cap applies)
  uncapped?: number // The uncapped value if it was capped
  wasCapped: boolean
}

/**
 * Apply stat cap to a calculated value
 * @param statType - The type of stat being capped
 * @param value - The calculated value before capping
 * @returns The capped result with information about whether capping occurred
 */
export function applyStatCap(
  statType: StatType,
  value: number,
): CappedStatResult {
  const cap = STAT_CAPS[statType]

  if (!cap) {
    return { value, wasCapped: false }
  }

  let cappedValue = value
  let wasCapped = false

  if (cap.max !== undefined && value > cap.max) {
    cappedValue = cap.max
    wasCapped = true
  }

  if (cap.min !== undefined && value < cap.min) {
    cappedValue = cap.min
    wasCapped = true
  }

  return wasCapped
    ? { value: cappedValue, uncapped: value, wasCapped: true }
    : { value, wasCapped: false }
}

/**
 * Check if a stat type has a cap defined
 */
export function hasStatCap(statType: StatType): boolean {
  return statType in STAT_CAPS
}

/**
 * Get the cap definition for a stat type
 */
export function getStatCap(statType: StatType): StatCap | undefined {
  return STAT_CAPS[statType]
}
