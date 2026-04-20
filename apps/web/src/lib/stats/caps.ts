import type { StatType } from "./types"

interface StatCap {
  min?: number
  max?: number
}

export const STAT_CAPS: Partial<Record<StatType, StatCap>> = {
  // Can't reduce cost below 25% (175% efficiency) or go below 0% efficiency.
  ability_efficiency: { min: 25, max: 175 },
  ability_duration: { min: 12.5 },
  ability_range: { min: 34 },
}

export function applyStatCap(
  statType: StatType,
  value: number,
): { value: number; uncapped?: number } {
  const cap = STAT_CAPS[statType]
  if (!cap) return { value }
  if (cap.max !== undefined && value > cap.max)
    return { value: cap.max, uncapped: value }
  if (cap.min !== undefined && value < cap.min)
    return { value: cap.min, uncapped: value }
  return { value }
}
