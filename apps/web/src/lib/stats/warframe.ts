import { rankUpFor } from "@arsenyx/shared/warframe/rankup"
import { shardValue } from "@arsenyx/shared/warframe/shards"
import type { PlacedShard, Warframe } from "@arsenyx/shared/warframe/types"

import { findShardStat } from "@/lib/shards"

import { EXCLUDED_WARFRAME_AURAS } from "./aura-ignore"
import { applyStatCap } from "./caps"
import { accumulate, round } from "./helpers"
import {
  collectSourcedStats,
  type PlacedArcaneInput,
  type PlacedModInput,
  type SourcedStat,
} from "./parser"
import type { StatType, StatValue, WarframeStats } from "./types"

// wiki.warframe.com/w/Umbral_Set: Vitality/Fiber scale +30%/+80%, Intensify +25%/+75%
const UMBRAL_SET_BONUSES: Record<string, Record<number, number>> = {
  "Umbral Vitality": { 1: 1.0, 2: 1.3, 3: 1.8 },
  "Umbral Fiber": { 1: 1.0, 2: 1.3, 3: 1.8 },
  "Umbral Intensify": { 1: 1.0, 2: 1.25, 3: 1.75 },
}
const UMBRAL_MODS = new Set(Object.keys(UMBRAL_SET_BONUSES))

/** Set-bonus multiplier on an Umbral mod's stats with `equipped` Umbral mods. */
export function umbralSetMultiplier(modName: string, equipped: number): number {
  return UMBRAL_SET_BONUSES[modName]?.[Math.min(equipped, 3)] ?? 1
}

interface WarframeCalcInput {
  warframe: Warframe
  mods: PlacedModInput[]
  arcanes: PlacedArcaneInput[]
  shards: (PlacedShard | null)[]
  skipRankUpBonus?: boolean
  showMaxStacks?: boolean
}

export interface CompanionStats {
  health: StatValue
  shield: StatValue
  armor: StatValue
  energy: StatValue
}

interface CompanionCalcInput {
  companion: {
    name: string
    health?: number
    shield?: number
    armor?: number
    power?: number
  }
  mods: PlacedModInput[]
  arcanes: PlacedArcaneInput[]
  showMaxStacks?: boolean
}

export function calculateCompanionStats(
  input: CompanionCalcInput,
): CompanionStats {
  const { companion, mods, arcanes } = input
  const stats = collectSourcedStats(mods, arcanes, {
    showMaxStacks: input.showMaxStacks,
  })
  return {
    health: calcSingle("health", companion.health ?? 0, stats, [], 0),
    shield: calcSingle("shield", companion.shield ?? 0, stats, [], 0),
    armor: calcSingle("armor", companion.armor ?? 0, stats, [], 0),
    energy: calcSingle("energy", companion.power ?? 0, stats, [], 0),
  }
}

export function calculateWarframeStats(
  input: WarframeCalcInput,
): WarframeStats {
  const { warframe, arcanes, shards } = input
  const mods = input.mods.filter(
    (m) => !EXCLUDED_WARFRAME_AURAS.has(m.mod.name),
  )

  const bonus = input.skipRankUpBonus
    ? { health: 0, shield: 0, armor: 0, energy: 0 }
    : rankUpFor(warframe.name)

  const baseHp = warframe.health + bonus.health
  const baseSh = warframe.shield + bonus.shield
  const baseAr = warframe.armor + bonus.armor
  const baseEn = warframe.power + bonus.energy

  const umbralCount = mods.filter((m) => UMBRAL_MODS.has(m.mod.name)).length
  const setMultiplierFor = (name: string): number =>
    umbralSetMultiplier(name, umbralCount)

  const stats = collectSourcedStats(mods, arcanes, {
    setMultiplierFor,
    showMaxStacks: input.showMaxStacks,
  })

  return {
    health: calcSingle("health", baseHp, stats, shards, 0),
    shield: calcSingle("shield", baseSh, stats, shards, 0),
    armor: calcSingle("armor", baseAr, stats, shards, 0),
    energy: calcSingle("energy", baseEn, stats, shards, 0),
    sprintSpeed: calcSingle(
      "sprint_speed",
      warframe.sprintSpeed ?? 1,
      stats,
      shards,
      2,
    ),
    abilityStrength: calcAbility("ability_strength", stats, shards),
    abilityDuration: calcAbility("ability_duration", stats, shards),
    abilityEfficiency: calcAbility("ability_efficiency", stats, shards),
    abilityRange: calcAbility("ability_range", stats, shards),
  }
}

const shardLabel = (color: string): string =>
  `${color[0].toUpperCase()}${color.slice(1)} Shard`

/** {@link accumulate} plus the placed shards that feed `statType`. */
function accumulateWithShards(
  statType: StatType,
  stats: SourcedStat[],
  shards: (PlacedShard | null)[],
) {
  const acc = accumulate(statType, stats)
  for (const shard of shards) {
    if (!shard) continue
    const stat = findShardStat(shard.color, shard.stat)
    // `satisfies`: a ShardBuildStat that isn't a StatType would never match.
    if (!stat || (stat.stat satisfies StatType | undefined) !== statType)
      continue
    const amount = shardValue(stat, shard.tauforged)
    const operation = stat.unit === "%" ? "percent_add" : "flat_add"
    if (operation === "percent_add") acc.percent += amount
    else acc.flat += amount
    acc.contributions.push({ name: shardLabel(shard.color), amount, operation })
  }
  return acc
}

function calcSingle(
  statType: StatType,
  base: number,
  stats: SourcedStat[],
  shards: (PlacedShard | null)[],
  digits: number,
): StatValue {
  const { percent, flat, contributions } = accumulateWithShards(
    statType,
    stats,
    shards,
  )
  const modified = base * (1 + percent / 100) + flat
  return {
    base: round(base, digits),
    modified: round(modified, digits),
    contributions,
  }
}

/** Ability stats are percentages of a 100% base; flat adds don't apply. */
function calcAbility(
  statType: StatType,
  stats: SourcedStat[],
  shards: (PlacedShard | null)[],
): StatValue {
  const base = 100
  const { percent, contributions } = accumulateWithShards(
    statType,
    stats,
    shards,
  )
  const capped = applyStatCap(statType, base + percent)
  return {
    base,
    modified: round(capped.value, 1),
    ...(capped.uncapped !== undefined
      ? { uncapped: round(capped.uncapped, 1) }
      : {}),
    contributions: contributions.filter((c) => c.operation === "percent_add"),
  }
}
