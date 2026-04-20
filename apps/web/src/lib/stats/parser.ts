import type { Arcane, Mod, RivenStats } from "@arsenyx/shared/warframe/types"

import type { ConditionLabel, ParsedStat, StatType } from "./types"
import { DAMAGE_TYPE_COLORS } from "./types"

type ConditionInfo =
  | { isConditional?: undefined }
  | { isConditional: true; maxStacks?: number; condition?: ConditionLabel }

const COLOR_TAG_PATTERN = /([+-]?\d+(?:\.\d+)?)\s*%\s*<([A-Z_]+)>([A-Za-z]+)/g
const PERCENT_PATTERN =
  /([+-]?\d+(?:\.\d+)?)\s*%\s+([A-Za-z][A-Za-z\s]*?)(?:\.|$|\n|,|<)/g
const FLAT_PATTERN =
  /([+-]\d+(?:\.\d+)?)\s+(?!%|s\b|m\b|x\b)([A-Za-z][A-Za-z\s]*?)(?:\.|$|\n|,)/g
const MULT_PATTERN =
  /(\d+(?:\.\d+)?)\s*x\s+([A-Za-z][A-Za-z\s]*?)(?:\.|$|\n|,)/g

const STAT_NAME_MAP: Record<string, StatType> = {
  health: "health",
  "maximum health": "health",
  shield: "shield",
  "shield capacity": "shield",
  shields: "shield",
  armor: "armor",
  "armor rating": "armor",
  energy: "energy",
  "energy max": "energy",
  "sprint speed": "sprint_speed",
  "ability strength": "ability_strength",
  strength: "ability_strength",
  "ability duration": "ability_duration",
  duration: "ability_duration",
  "ability efficiency": "ability_efficiency",
  efficiency: "ability_efficiency",
  "ability range": "ability_range",
  range: "range",
  damage: "damage",
  "critical chance": "critical_chance",
  "crit chance": "critical_chance",
  "critical damage": "critical_multiplier",
  "critical multiplier": "critical_multiplier",
  "crit damage": "critical_multiplier",
  "crit multiplier": "critical_multiplier",
  "status chance": "status_chance",
  "fire rate": "fire_rate",
  "attack speed": "fire_rate",
  "magazine size": "magazine_size",
  "magazine capacity": "magazine_size",
  "reload speed": "reload_speed",
  "reload time": "reload_speed",
  multishot: "multishot",
  "punch through": "punch_through",
  "combo duration": "combo_duration",
  impact: "impact",
  puncture: "puncture",
  slash: "slash",
  heat: "heat",
  cold: "cold",
  electricity: "electricity",
  toxin: "toxin",
  blast: "blast",
  radiation: "radiation",
  gas: "gas",
  magnetic: "magnetic",
  viral: "viral",
  corrosive: "corrosive",
  "melee damage": "melee_damage",
  "tau resistance": "tau_resistance",
  "status duration": "status_duration",
  "damage to grineer": "damage_vs_grineer",
  "damage to corpus": "damage_vs_corpus",
  "damage to infested": "damage_vs_infested",
  "damage to corrupted": "damage_vs_corrupted",
  "damage to sentient": "damage_vs_sentient",
  "damage to sentients": "damage_vs_sentient",
  "projectile speed": "projectile_speed",
  "projectile flight speed": "projectile_speed",
  "flight speed": "projectile_speed",
  "ammo max": "ammo_max",
  "ammo maximum": "ammo_max",
  "maximum ammo": "ammo_max",
  zoom: "zoom",
  recoil: "recoil",
  "weapon recoil": "recoil",
  "finisher damage": "finisher_damage",
  "slide attack": "slide_attack",
  "slide attack crit chance": "slide_attack",
  "channeling damage": "channeling",
  "channeling efficiency": "channeling",
}

const CONDITIONAL_PATTERNS = [
  /on kill/i,
  /on hit/i,
  /when damaged/i,
  /stacks up to/i,
  /for \d+(?:\.\d+)?\s*s\b/i,
  /after (?:a )?(?:reload|headshot|kill)/i,
]

const STACK_PATTERN = /stacks? up to (\d+)/i

const CONDITION_LABELS: Record<string, ConditionLabel> = {
  "on kill": "On Kill",
  "on hit": "On Hit",
  "when damaged": "When Damaged",
  "after reload": "After Reload",
  "after headshot": "After Headshot",
}

const CONDITION_LABEL_PATTERN = new RegExp(
  `^(${Object.keys(CONDITION_LABELS).join("|")})`,
  "i",
)

function detectCondition(statString: string): ConditionInfo {
  if (!CONDITIONAL_PATTERNS.some((p) => p.test(statString))) return {}
  const stackMatch = statString.match(STACK_PATTERN)
  const maxStacks = stackMatch ? parseInt(stackMatch[1], 10) : undefined
  const labelMatch = statString.match(CONDITION_LABEL_PATTERN)
  const condition = labelMatch
    ? CONDITION_LABELS[labelMatch[1].toLowerCase()]
    : undefined
  return { isConditional: true, maxStacks, condition }
}

export interface PlacedModInput {
  mod: Mod
  rank: number
}

export interface PlacedArcaneInput {
  arcane: Arcane
  rank: number
}

const modCache = new WeakMap<Mod, Map<number, ParsedStat[]>>()

/** Parse all stat effects from a placed mod at its current rank. */
export function parseModStats(input: PlacedModInput): ParsedStat[] {
  const { mod, rank } = input

  // Rivens: synthesize stat strings from rivenStats instead of levelStats.
  if (mod.rivenStats) {
    return parseRivenStats(mod.rivenStats)
  }

  let perRank = modCache.get(mod)
  if (!perRank) {
    perRank = new Map()
    modCache.set(mod, perRank)
  }
  const cached = perRank.get(rank)
  if (cached) return cached

  const results: ParsedStat[] = []
  const levels = mod.levelStats
  if (levels && levels.length > 0) {
    const rankIndex = Math.min(Math.max(rank, 0), levels.length - 1)
    const levelData = levels[rankIndex]
    if (levelData?.stats) {
      for (const s of levelData.stats) {
        results.push(...parseStatString(s))
      }
    }
  }
  perRank.set(rank, results)
  return results
}

const arcaneCache = new WeakMap<Arcane, Map<number, ParsedStat[]>>()

/** Parse stat effects from a placed arcane (same levelStats shape as mods). */
export function parseArcaneStats(input: PlacedArcaneInput): ParsedStat[] {
  const { arcane, rank } = input

  let perRank = arcaneCache.get(arcane)
  if (!perRank) {
    perRank = new Map()
    arcaneCache.set(arcane, perRank)
  }
  const cached = perRank.get(rank)
  if (cached) return cached

  const out: ParsedStat[] = []
  const levels = arcane.levelStats
  if (levels && levels.length > 0) {
    const rankIndex = Math.min(Math.max(rank, 0), levels.length - 1)
    const levelData = levels[rankIndex]
    if (levelData?.stats) {
      for (const s of levelData.stats) {
        out.push(...parseStatString(s))
      }
    }
  }
  perRank.set(rank, out)
  return out
}

/** Convert a RivenStats object into ParsedStats. Negatives already carry sign. */
export function parseRivenStats(rivenStats: RivenStats): ParsedStat[] {
  const out: ParsedStat[] = []
  for (const p of rivenStats.positives) {
    const mapped = STAT_NAME_MAP[p.stat.toLowerCase()]
    if (!mapped) continue
    out.push({ type: mapped, value: p.value, operation: "percent_add" })
  }
  for (const n of rivenStats.negatives) {
    const mapped = STAT_NAME_MAP[n.stat.toLowerCase()]
    if (!mapped) continue
    out.push({ type: mapped, value: n.value, operation: "percent_add" })
  }
  return out
}

/** Parse a single stat string from WFCD data. */
export function parseStatString(statString: string): ParsedStat[] {
  const results: ParsedStat[] = []

  const lower = statString.toLowerCase()
  if (lower.includes("augment:")) return results
  if (lower.includes("pickups give")) return results
  if (lower.includes("lethal damage")) return results

  const cond = detectCondition(statString)

  let match: RegExpMatchArray

  for (match of statString.matchAll(COLOR_TAG_PATTERN)) {
    const value = parseFloat(match[1])
    const colorTag = match[2]
    const damageType = DAMAGE_TYPE_COLORS[colorTag]
    if (damageType) {
      results.push({
        type: damageType as StatType,
        value,
        operation: "percent_add",
        damageType,
        ...cond,
      })
    }
  }

  for (match of statString.matchAll(PERCENT_PATTERN)) {
    const value = parseFloat(match[1])
    const statName = match[2].trim().toLowerCase()
    if (DAMAGE_TYPE_COLORS[`DT_${statName.toUpperCase()}_COLOR`]) continue
    const statType = STAT_NAME_MAP[statName]
    if (statType) {
      results.push({ type: statType, value, operation: "percent_add", ...cond })
    }
  }

  for (match of statString.matchAll(FLAT_PATTERN)) {
    const value = parseFloat(match[1])
    const statName = match[2].trim().toLowerCase()
    if (
      ["damage", "enemies", "seconds", "meters", "radius"].some((s) =>
        statName.includes(s),
      )
    ) {
      continue
    }
    const statType = STAT_NAME_MAP[statName]
    if (statType) {
      if (!results.find((r) => r.type === statType)) {
        results.push({ type: statType, value, operation: "flat_add", ...cond })
      }
    }
  }

  for (match of statString.matchAll(MULT_PATTERN)) {
    const value = parseFloat(match[1])
    const statName = match[2].trim().toLowerCase()
    const statType = STAT_NAME_MAP[statName]
    if (statType) {
      results.push({
        type: statType,
        value,
        operation: "percent_mult",
        ...cond,
      })
    }
  }

  return results
}

export interface SourcedStat extends ParsedStat {
  sourceName: string
}

export interface CollectOptions {
  setMultiplierFor?: (modName: string) => number
  /** When true, conditional stats apply at full stacks (maxStacks × value).
   * When false (default), conditional stats are omitted from the running
   * total — they are shown separately in the contributions list instead. */
  showMaxStacks?: boolean
}

interface Source {
  stats: ParsedStat[]
  sourceName: string
  mult: number
}

/** Flatten mods + arcanes into a single list tagged with source names. */
export function collectSourcedStats(
  mods: PlacedModInput[],
  arcanes: PlacedArcaneInput[],
  opts?: CollectOptions,
): SourcedStat[] {
  const showMax = opts?.showMaxStacks ?? false
  const sources: Source[] = []
  for (const m of mods) {
    sources.push({
      stats: parseModStats(m),
      sourceName: m.mod.rivenStats !== undefined ? "Riven" : m.mod.name,
      mult: opts?.setMultiplierFor?.(m.mod.name) ?? 1,
    })
  }
  for (const a of arcanes) {
    sources.push({
      stats: parseArcaneStats(a),
      sourceName: a.arcane.name,
      mult: 1,
    })
  }

  const out: SourcedStat[] = []
  for (const { stats, sourceName, mult } of sources) {
    for (const s of stats) {
      if (s.isConditional && !showMax) continue
      const stacks = s.isConditional && s.maxStacks ? s.maxStacks : 1
      const value =
        s.operation === "percent_add"
          ? s.value * mult * stacks
          : s.value * stacks
      out.push({ ...s, value, sourceName })
    }
  }
  return out
}

/** True if any placed mod/arcane carries a conditional stat — used to gate
 *  the "Max stacks" toggle in the UI. */
export function hasConditionalStats(
  mods: PlacedModInput[],
  arcanes: PlacedArcaneInput[],
): boolean {
  for (const m of mods) {
    if (parseModStats(m).some((s) => s.isConditional)) return true
  }
  for (const a of arcanes) {
    if (parseArcaneStats(a).some((s) => s.isConditional)) return true
  }
  return false
}
