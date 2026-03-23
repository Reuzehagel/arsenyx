// Warframe-specific stat calculations (health, shields, armor, energy, abilities)

import { findStat as findShardStat } from "../shards"
import { applyStatCap } from "../stat-caps"
import { parseModStats } from "../stat-parser"
import type {
  WarframeStats,
  StatValue,
  StatContribution,
  StatType,
} from "../stat-types"
import type { BuildState, PlacedMod, Warframe, PlacedShard } from "../types"
import {
  UMBRAL_MODS,
  UMBRAL_SET_BONUSES,
  getAllPlacedMods,
  countUmbralMods,
  getStatValue,
} from "./stat-engine"

type WarframeRankUpBonus = {
  health: number
  shield: number
  armor: number
  energy: number
}

// Rank-up bonuses from rank 0 -> rank 30.
// Default values follow the in-game rank-up rules (health/shields/energy).
// Some frames have exceptions.
const DEFAULT_WARFRAME_RANKUP_BONUS: WarframeRankUpBonus = {
  health: 100,
  shield: 100,
  armor: 0,
  energy: 50,
}

// Warframe rank-up exceptions (from Module:Warframes/data on the wiki).
// Values are the total bonus gained by rank 30.
const WARFRAME_RANKUP_BONUS_BY_NAME: Record<string, WarframeRankUpBonus> = {
  Baruuk: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Baruuk Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  "Chroma Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Dante: { health: 90, shield: 90, armor: 0, energy: 70 },
  Garuda: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Garuda Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Grendel: { health: 200, shield: 0, armor: 0, energy: 50 },
  "Grendel Prime": { health: 200, shield: 0, armor: 0, energy: 50 },
  Hildryn: { health: 100, shield: 500, armor: 0, energy: 0 },
  "Hildryn Prime": { health: 100, shield: 500, armor: 0, energy: 0 },
  Inaros: { health: 200, shield: 0, armor: 0, energy: 50 },
  "Inaros Prime": { health: 200, shield: 0, armor: 0, energy: 50 },
  Koumei: { health: 100, shield: 100, armor: 0, energy: 100 },
  Kullervo: { health: 200, shield: 0, armor: 100, energy: 50 },
  Lavos: { health: 200, shield: 100, armor: 100, energy: 0 },
  "Lavos Prime": { health: 200, shield: 100, armor: 100, energy: 0 },
  Nezha: { health: 100, shield: 50, armor: 0, energy: 50 },
  "Nezha Prime": { health: 100, shield: 50, armor: 0, energy: 50 },
  Nidus: { health: 100, shield: 0, armor: 100, energy: 50 },
  "Nidus Prime": { health: 100, shield: 0, armor: 100, energy: 50 },
  "Saryn Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Valkyr: { health: 100, shield: 50, armor: 0, energy: 50 },
  "Valkyr Prime": { health: 100, shield: 50, armor: 0, energy: 50 },
  "Volt Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Wisp: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Wisp Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Xaku: { health: 90, shield: 90, armor: 0, energy: 70 },
  "Xaku Prime": { health: 90, shield: 90, armor: 0, energy: 70 },
  Yareli: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Yareli Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
}

function getWarframeRank30BaseStats(warframe: Warframe) {
  const bonus =
    WARFRAME_RANKUP_BONUS_BY_NAME[warframe.name] ??
    DEFAULT_WARFRAME_RANKUP_BONUS

  return {
    health: warframe.health + bonus.health,
    shield: warframe.shield + bonus.shield,
    armor: warframe.armor + bonus.armor,
    energy: warframe.power + bonus.energy,
  }
}

/**
 * Calculate warframe stats including health, shields, armor, energy, and ability stats
 */
export function calculateWarframeStats(
  warframe: Warframe,
  buildState: BuildState,
  showMaxStacks = false,
): WarframeStats {
  const mods = getAllPlacedMods(buildState)
  const shards = buildState.shardSlots ?? []
  const umbralCount = countUmbralMods(mods)

  const rank30 = getWarframeRank30BaseStats(warframe)

  return {
    health: calculateSingleStat(
      "health",
      rank30.health,
      mods,
      shards,
      umbralCount,
      showMaxStacks,
    ),
    shield: calculateSingleStat(
      "shield",
      rank30.shield,
      mods,
      shards,
      umbralCount,
      showMaxStacks,
    ),
    armor: calculateSingleStat(
      "armor",
      rank30.armor,
      mods,
      shards,
      umbralCount,
      showMaxStacks,
    ),
    energy: calculateSingleStat(
      "energy",
      rank30.energy,
      mods,
      shards,
      umbralCount,
      showMaxStacks,
    ),
    sprintSpeed: calculateSingleStat(
      "sprint_speed",
      warframe.sprintSpeed ?? 1.0,
      mods,
      shards,
      umbralCount,
      showMaxStacks,
    ),
    abilityStrength: calculateAbilityStat(
      "ability_strength",
      mods,
      shards,
      showMaxStacks,
    ),
    abilityDuration: calculateAbilityStat(
      "ability_duration",
      mods,
      shards,
      showMaxStacks,
    ),
    abilityEfficiency: calculateAbilityStat(
      "ability_efficiency",
      mods,
      shards,
      showMaxStacks,
    ),
    abilityRange: calculateAbilityStat(
      "ability_range",
      mods,
      shards,
      showMaxStacks,
    ),
  }
}

/**
 * Calculate a single warframe stat (health, shield, armor, energy, sprint speed)
 */
function calculateSingleStat(
  statType: StatType,
  baseValue: number,
  mods: PlacedMod[],
  shards: (PlacedShard | null)[],
  umbralCount: number,
  showMaxStacks: boolean,
): StatValue {
  const contributions: StatContribution[] = []
  let flatBonus = 0
  let percentBonus = 0

  // Collect mod contributions
  for (const mod of mods) {
    const parsedStats = parseModStats(mod)
    for (const stat of parsedStats) {
      if (stat.type === statType) {
        const value = getStatValue(stat, showMaxStacks)

        if (stat.operation === "flat_add") {
          flatBonus += value
          contributions.push({
            source: "mod",
            name: mod.name,
            absoluteValue: value,
            percentOfBonus: 0, // Calculated later
          })
        } else if (stat.operation === "percent_add") {
          // Apply Umbral set bonus if applicable
          const isUmbral = UMBRAL_MODS.has(mod.name)
          const setMultiplier = isUmbral
            ? (UMBRAL_SET_BONUSES[umbralCount] ?? 1)
            : 1
          const adjustedValue = value * setMultiplier

          percentBonus += adjustedValue
          contributions.push({
            source: isUmbral && umbralCount > 1 ? "set_bonus" : "mod",
            name: mod.name,
            absoluteValue: (baseValue * adjustedValue) / 100,
            percentOfBonus: 0,
          })
        }
      }
    }
  }

  // Collect shard contributions
  for (const shard of shards) {
    if (!shard) continue

    const shardStat = findShardStat(shard.color, shard.stat)
    if (!shardStat) continue

    // Map shard stat names to our stat types
    const shardStatMap: Record<string, StatType> = {
      Health: "health",
      "Shield Capacity": "shield",
      Armor: "armor",
      "Energy Max": "energy",
      "Parkour Velocity": "sprint_speed",
    }

    const mappedType = shardStatMap[shard.stat]
    if (mappedType === statType) {
      const value = shard.tauforged
        ? shardStat.tauforgedValue
        : shardStat.baseValue

      // Azure shards for health/shield/armor/energy are flat additions
      if (shardStat.unit === "") {
        flatBonus += value
        contributions.push({
          source: "shard",
          name: `${
            shard.color.charAt(0).toUpperCase() + shard.color.slice(1)
          } Archon Shard`,
          absoluteValue: value,
          percentOfBonus: 0,
        })
      } else if (shardStat.unit === "%") {
        percentBonus += value
        contributions.push({
          source: "shard",
          name: `${
            shard.color.charAt(0).toUpperCase() + shard.color.slice(1)
          } Archon Shard`,
          absoluteValue: (baseValue * value) / 100,
          percentOfBonus: 0,
        })
      }
    }
  }

  // Calculate final value
  // Formula: (Base + FlatBonus) × (1 + ΣPercentBonuses/100)
  const modified = (baseValue + flatBonus) * (1 + percentBonus / 100)

  // Calculate percent of bonus for each contribution
  const totalBonus = modified - baseValue
  if (totalBonus > 0) {
    for (const contrib of contributions) {
      contrib.percentOfBonus = (contrib.absoluteValue / totalBonus) * 100
    }
  }

  return {
    base: baseValue,
    modified: Math.round(modified * 100) / 100, // Round to 2 decimal places
    contributions,
  }
}

/**
 * Calculate ability stats (percentage-based, 100% = base)
 */
function calculateAbilityStat(
  statType: StatType,
  mods: PlacedMod[],
  shards: (PlacedShard | null)[],
  showMaxStacks: boolean,
): StatValue {
  const baseValue = 100 // Ability stats start at 100%
  const contributions: StatContribution[] = []
  let totalBonus = 0

  // Collect mod contributions
  for (const mod of mods) {
    const parsedStats = parseModStats(mod)
    for (const stat of parsedStats) {
      if (stat.type === statType) {
        const value = getStatValue(stat, showMaxStacks)
        totalBonus += value

        contributions.push({
          source: "mod",
          name: mod.name,
          absoluteValue: value,
          percentOfBonus: 0,
        })
      }
    }
  }

  // Collect shard contributions for ability stats
  for (const shard of shards) {
    if (!shard) continue

    const shardStat = findShardStat(shard.color, shard.stat)
    if (!shardStat) continue

    const shardStatMap: Record<string, StatType> = {
      "Ability Strength": "ability_strength",
      "Ability Duration": "ability_duration",
    }

    const mappedType = shardStatMap[shard.stat]
    if (mappedType === statType && shardStat.unit === "%") {
      const value = shard.tauforged
        ? shardStat.tauforgedValue
        : shardStat.baseValue
      totalBonus += value

      contributions.push({
        source: "shard",
        name: `${
          shard.color.charAt(0).toUpperCase() + shard.color.slice(1)
        } Archon Shard`,
        absoluteValue: value,
        percentOfBonus: 0,
      })
    }
  }

  const modified = baseValue + totalBonus

  // Apply stat cap
  const capResult = applyStatCap(statType, modified)

  // Calculate percent of bonus
  const actualBonus = Math.abs(totalBonus)
  if (actualBonus > 0) {
    for (const contrib of contributions) {
      contrib.percentOfBonus =
        (Math.abs(contrib.absoluteValue) / actualBonus) * 100
    }
  }

  return {
    base: baseValue,
    modified: capResult.value,
    capped: capResult.uncapped,
    contributions,
  }
}
