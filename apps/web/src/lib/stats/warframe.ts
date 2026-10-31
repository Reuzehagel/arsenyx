import { rankUpFor } from "@arsenyx/shared/warframe/rankup"
import type { Warframe } from "@arsenyx/shared/warframe/types"

import { findShardStat, type PlacedShard } from "@/lib/shards"

import { EXCLUDED_WARFRAME_AURAS } from "./aura-ignore"
import { applyStatCap } from "./caps"
import { accumulate, round } from "./helpers"
import {
  collectSourcedStats,
  type PlacedArcaneInput,
  type PlacedModInput,
  type SourcedStat,
} from "./parser"
import type {
  StatContribution,
  StatType,
  StatValue,
  WarframeStats,
} from "./types"

// wiki.warframe.com/w/Umbral_Set: Vitality/Fiber scale +30%/+80%, Intensify +25%/+75%
const UMBRAL_SET_BONUSES: Record<string, Record<number, number>> = {
  "Umbral Vitality": { 1: 1.0, 2: 1.3, 3: 1.8 },
  "Umbral Fiber": { 1: 1.0, 2: 1.3, 3: 1.8 },
  "Umbral Intensify": { 1: 1.0, 2: 1.25, 3: 1.75 },
}
const UMBRAL_MODS = new Set(Object.keys(UMBRAL_SET_BONUSES))

export interface WarframeCalcInput {
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

export interface CompanionCalcInput {
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
    UMBRAL_SET_BONUSES[name]?.[umbralCount] ?? 1

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

const SHARD_FLAT_MAP: Record<string, StatType> = {
  Health: "health",
  "Shield Capacity": "shield",
  Armor: "armor",
  "Energy Max": "energy",
}

const SHARD_PCT_MAP: Record<string, StatType> = {
  "Parkour Velocity": "sprint_speed",
  "Ability Strength": "ability_strength",
  "Ability Duration": "ability_duration",
}

function calcSingle(
  statType: StatType,
  base: number,
  stats: SourcedStat[],
  shards: (PlacedShard | null)[],
  digits: number,
): StatValue {
  const {
    percent: basePercent,
    flat: baseFlat,
    contributions,
  } = accumulate(statType, stats)
  let percent = basePercent
  let flat = baseFlat

  for (const shard of shards) {
    if (!shard) continue
    const stat = findShardStat(shard.color, shard.stat)
    if (!stat) continue
    const name = shardLabel(shard.color)
    const value = shard.tauforged ? stat.tauforgedValue : stat.baseValue
    if (stat.unit === "" && SHARD_FLAT_MAP[shard.stat] === statType) {
      flat += value
      contributions.push({ name, amount: value, operation: "flat_add" })
    } else if (stat.unit === "%" && SHARD_PCT_MAP[shard.stat] === statType) {
      percent += value
      contributions.push({ name, amount: value, operation: "percent_add" })
    }
  }

  const modified = base * (1 + percent / 100) + flat
  return {
    base: round(base, digits),
    modified: round(modified, digits),
    contributions,
  }
}

function calcAbility(
  statType: StatType,
  stats: SourcedStat[],
  shards: (PlacedShard | null)[],
): StatValue {
  const base = 100
  const contributions: StatContribution[] = []
  let percent = 0
  for (const s of stats) {
    if (s.type !== statType || s.operation !== "percent_add") continue
    percent += s.value
    contributions.push({
      name: s.sourceName,
      amount: s.value,
      operation: "percent_add",
    })
  }
  for (const shard of shards) {
    if (!shard) continue
    if (SHARD_PCT_MAP[shard.stat] !== statType) continue
    const stat = findShardStat(shard.color, shard.stat)
    if (!stat || stat.unit !== "%") continue
    const value = shard.tauforged ? stat.tauforgedValue : stat.baseValue
    percent += value
    contributions.push({
      name: shardLabel(shard.color),
      amount: value,
      operation: "percent_add",
    })
  }
  const uncapped = base + percent
  const capped = applyStatCap(statType, uncapped)
  return {
    base,
    modified: round(capped.value, 1),
    ...(capped.uncapped !== undefined
      ? { uncapped: round(capped.uncapped, 1) }
      : {}),
    contributions,
  }
}
