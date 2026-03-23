// Aura effects configuration
// Only self-affecting auras are included (squad/enemy effects excluded from calculation)

import type { StatType } from "./stat-types"

// Aura stat definition
interface AuraStat {
  type: StatType
  value: number // Value at max rank
  perRank: number // Value increase per rank (from rank 0)
}

// Self-affecting auras that should be included in stat calculations
// These auras affect the warframe wearing them (squad bonuses apply to self too)
export const SELF_AFFECTING_AURAS: Record<string, AuraStat[]> = {
  // Health/Shield/Armor auras
  Physique: [{ type: "health", value: 20, perRank: 3.4 }], // +20% health at max (stacks with squad)
  "Stand United": [{ type: "armor", value: 25, perRank: 4.2 }], // +25% armor at max

  // Damage auras
  "Steel Charge": [{ type: "melee_damage", value: 60, perRank: 10 }], // +60% melee damage at max

  // Ability auras
  "Growing Power": [
    { type: "ability_strength", value: 25, perRank: 4.2 }, // +25% ability strength on status proc (conditional)
  ],

  // Energy auras (passive regeneration, not a direct stat)
  // "Energy Siphon" excluded - it's energy regen, not a stat modifier

  // Sprint/movement auras
  Sprint: [{ type: "sprint_speed", value: 15, perRank: 2.5 }], // +15% sprint speed
  "Sprint Boost": [{ type: "sprint_speed", value: 18, perRank: 3 }], // +18% sprint speed at max
}

// Auras that affect enemies or only squad members (excluded from self-calculation)
export const EXCLUDED_AURAS: Set<string> = new Set([
  "Corrosive Projection", // Reduces enemy armor - doesn't affect warframe stats
  "Dead Eye", // Sniper damage, affects weapon not warframe
  "Enemy Radar", // Utility, no stat effect
  "Loot Detector", // Utility, no stat effect
  "Rejuvenation", // Health regen over time, not a stat modifier
  "Energy Siphon", // Energy regen over time, not a stat modifier
  "Rifle Amp", // Rifle damage, affects weapon calculations
  "Shotgun Amp", // Shotgun damage, affects weapon calculations
  "Pistol Amp", // Pistol damage, affects weapon calculations
  "EMP Aura", // Affects enemies
  "Infested Impedance", // Affects enemies
  "Shield Disruption", // Affects enemies
  "Speed Holster", // Holster speed, not a combat stat
  "Brief Respite", // Shield on ability cast, not a direct stat
])

/**
 * Check if an aura is self-affecting and should be included in stat calculations
 */
export function isAuraSelfAffecting(auraName: string): boolean {
  return auraName in SELF_AFFECTING_AURAS
}

/**
 * Get the stat effects of a self-affecting aura at a specific rank
 */
export function getAuraStats(
  auraName: string,
  rank: number,
): { type: StatType; value: number }[] {
  const auraStats = SELF_AFFECTING_AURAS[auraName]
  if (!auraStats) return []

  return auraStats.map((stat) => ({
    type: stat.type,
    // Calculate value based on rank: base value at rank 0 is (value - perRank * maxRank)
    // For simplicity, assume max rank gives full value
    value: stat.perRank * (rank + 1),
  }))
}

/**
 * Get the max rank value of an aura stat
 */
export function getAuraMaxValue(
  auraName: string,
  statType: StatType,
): number | undefined {
  const auraStats = SELF_AFFECTING_AURAS[auraName]
  if (!auraStats) return undefined

  const stat = auraStats.find((s) => s.type === statType)
  return stat?.value
}
