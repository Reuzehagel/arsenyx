import type { Warframe } from "@arsenyx/shared/warframe/types"

import { findShardStat, type PlacedShard } from "@/lib/shards"

import { EXCLUDED_WARFRAME_AURAS } from "./aura-ignore"
import { applyStatCap } from "./caps"
import { round } from "./helpers"
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

const UMBRAL_MODS = new Set([
  "Umbral Vitality",
  "Umbral Intensify",
  "Umbral Fiber",
])
const UMBRAL_SET_BONUSES: Record<number, number> = { 1: 1.0, 2: 1.25, 3: 1.75 }

type RankUp = { health: number; shield: number; armor: number; energy: number }

const DEFAULT_RANKUP: RankUp = {
  health: 100,
  shield: 100,
  armor: 0,
  energy: 50,
}

const RANKUP_BY_NAME: Record<string, RankUp> = {
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
    : (RANKUP_BY_NAME[warframe.name] ?? DEFAULT_RANKUP)

  const baseHp = warframe.health + bonus.health
  const baseSh = warframe.shield + bonus.shield
  const baseAr = warframe.armor + bonus.armor
  const baseEn = warframe.power + bonus.energy

  const umbralCount = mods.filter((m) => UMBRAL_MODS.has(m.mod.name)).length
  const setMultiplierFor = (name: string): number =>
    UMBRAL_MODS.has(name) ? (UMBRAL_SET_BONUSES[umbralCount] ?? 1) : 1

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
  const contributions: StatContribution[] = []
  let percent = 0
  let flat = 0

  for (const s of stats) {
    if (s.type !== statType) continue
    if (s.operation === "flat_add") {
      flat += s.value
      contributions.push({
        name: s.sourceName,
        amount: s.value,
        operation: "flat_add",
      })
    } else if (s.operation === "percent_add") {
      percent += s.value
      contributions.push({
        name: s.sourceName,
        amount: s.value,
        operation: "percent_add",
      })
    }
  }

  for (const shard of shards) {
    if (!shard) continue
    const stat = findShardStat(shard.color, shard.stat)
    if (!stat) continue
    const name = `${shard.color[0].toUpperCase()}${shard.color.slice(1)} Shard`
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
      name: `${shard.color[0].toUpperCase()}${shard.color.slice(1)} Shard`,
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
