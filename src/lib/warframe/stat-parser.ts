// Mod stat parser - extracts stat effects from WFCD mod data
// Primary source: structured levelStats array
// Fallback: regex parsing of description strings

import type { ParsedStat, StatType } from "./stat-types"
import { DAMAGE_TYPE_COLORS } from "./stat-types"
import type { PlacedMod } from "./types"

// Mapping from common stat names in WFCD data to our StatType enum
const STAT_NAME_MAP: Record<string, StatType> = {
  // Warframe stats
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
  // Ability stats
  "ability strength": "ability_strength",
  strength: "ability_strength",
  "ability duration": "ability_duration",
  duration: "ability_duration",
  "ability efficiency": "ability_efficiency",
  efficiency: "ability_efficiency",
  "ability range": "ability_range",
  range: "range", // Can be ability range or weapon range depending on context
  // Weapon stats
  damage: "damage",
  "critical chance": "critical_chance",
  "crit chance": "critical_chance",
  "critical damage": "critical_multiplier",
  "critical multiplier": "critical_multiplier",
  "crit damage": "critical_multiplier",
  "crit multiplier": "critical_multiplier",
  "status chance": "status_chance",
  "fire rate": "fire_rate",
  "attack speed": "fire_rate", // Melee attack speed maps to fire_rate
  "magazine size": "magazine_size",
  "magazine capacity": "magazine_size",
  "reload speed": "reload_speed",
  "reload time": "reload_speed",
  multishot: "multishot",
  "punch through": "punch_through",
  "combo duration": "combo_duration",
  // Physical damage
  impact: "impact",
  puncture: "puncture",
  slash: "slash",
  // Elemental damage
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
  // Special
  "melee damage": "melee_damage",
  "tau resistance": "tau_resistance",
}

// Patterns for conditional/stacking mods
const CONDITIONAL_PATTERNS = [
  /on kill/i,
  /on hit/i,
  /when damaged/i,
  /stacks up to/i,
  /for \d+s/i,
]

// Patterns for extracting stack count
const STACK_PATTERN = /stacks? up to (\d+)/i

const parseModStatsCache = new WeakMap<PlacedMod, ParsedStat[]>()

/**
 * Parse stat effects from a placed mod at its current rank
 */
export function parseModStats(mod: PlacedMod): ParsedStat[] {
  const cached = parseModStatsCache.get(mod)
  if (cached) return cached

  try {
    // Try structured data first (levelStats array)
    if (mod.levelStats && mod.levelStats.length > 0) {
      const rankIndex = Math.min(mod.rank, mod.levelStats.length - 1)
      const levelData = mod.levelStats[rankIndex]

      if (levelData?.stats && levelData.stats.length > 0) {
        const results: ParsedStat[] = []
        for (const statString of levelData.stats) {
          const parsed = parseStatString(statString)
          results.push(...parsed)
        }
        parseModStatsCache.set(mod, results)
        return results
      }
    }

    parseModStatsCache.set(mod, [])
    return []
  } catch (error) {
    console.warn(`Failed to parse mod stats for ${mod.name}:`, error)
    return []
  }
}

/**
 * Parse a single stat string from WFCD data
 * Examples:
 * - "+100% Health"
 * - "+165% Damage"
 * - "+60% <DT_FIRE_COLOR>Heat"
 * - "-55% Ability Efficiency"
 * - "On Kill:\n+40% Direct Damage per Status Type affecting the target for 20s. Stacks up to 2x."
 */
export function parseStatString(statString: string): ParsedStat[] {
  const results: ParsedStat[] = []

  // Skip augment descriptions and complex ability effects
  if (statString.includes("Augment:") || statString.includes("augment:")) {
    return results
  }

  // Skip pickup-related effects (e.g., Equilibrium: "Health pickups give +110% Energy")
  // These are gameplay mechanics, not direct stat buffs
  if (statString.toLowerCase().includes("pickups give")) {
    return results
  }

  // Skip lethal damage prevention mechanics (e.g., Quick Thinking: "...Lethal Damage with 240% Efficiency")
  // The "Efficiency" here is the mod's conversion rate, not Ability Efficiency
  if (statString.toLowerCase().includes("lethal damage")) {
    return results
  }

  // Check if this is a conditional stat
  const isConditional = CONDITIONAL_PATTERNS.some((p) => p.test(statString))
  const stackMatch = statString.match(STACK_PATTERN)
  const maxStacks = stackMatch ? parseInt(stackMatch[1], 10) : undefined

  // Extract conditional description if present
  let conditionDescription: string | undefined
  if (isConditional) {
    const condMatch = statString.match(/^(on kill|when damaged|on hit):/i)
    if (condMatch) {
      conditionDescription = condMatch[1]
    }
  }

  // Process percentage with color tags first
  // Pattern: +90% <DT_HEAT_COLOR>Heat
  const colorTagPattern = /([+-]?\d+(?:\.\d+)?)\s*%\s*<([A-Z_]+)>([A-Za-z]+)/g
  let match

  while ((match = colorTagPattern.exec(statString)) !== null) {
    const value = parseFloat(match[1])
    const colorTag = match[2]
    // Note: match[3] is the stat name (e.g., "Heat") but we derive type from color tag

    // Get damage type from color tag
    const damageType = DAMAGE_TYPE_COLORS[colorTag]

    if (damageType) {
      results.push({
        type: damageType as StatType,
        value,
        operation: "percent_add",
        damageType,
        isConditional,
        maxStacks,
        conditionDescription,
      })
    }
  }

  // Process percentage without color tags
  const percentPattern =
    /([+-]?\d+(?:\.\d+)?)\s*%\s+([A-Za-z][A-Za-z\s]*?)(?:\.|$|\n|,|<)/g

  while ((match = percentPattern.exec(statString)) !== null) {
    const value = parseFloat(match[1])
    const statName = match[2].trim().toLowerCase()

    // Skip if it's a damage type we already processed with color tag
    if (DAMAGE_TYPE_COLORS[`DT_${statName.toUpperCase()}_COLOR`]) {
      continue
    }

    const statType = STAT_NAME_MAP[statName]
    if (statType) {
      results.push({
        type: statType,
        value,
        operation: "percent_add",
        isConditional,
        maxStacks,
        conditionDescription,
      })
    }
  }

  // Process flat additions (rare, e.g., some companion mods)
  // Be careful not to match values that are part of other text
  const flatPattern =
    /([+-]\d+(?:\.\d+)?)\s+(?!%|s\b|m\b|x\b)([A-Za-z][A-Za-z\s]*?)(?:\.|$|\n|,)/g

  while ((match = flatPattern.exec(statString)) !== null) {
    const value = parseFloat(match[1])
    const statName = match[2].trim().toLowerCase()

    // Skip common non-stat values
    if (
      ["damage", "enemies", "seconds", "meters", "radius"].some((s) =>
        statName.includes(s),
      )
    ) {
      continue
    }

    const statType = STAT_NAME_MAP[statName]
    if (statType) {
      // Check if we already have this stat as a percentage
      const existing = results.find((r) => r.type === statType)
      if (!existing) {
        results.push({
          type: statType,
          value,
          operation: "flat_add",
          isConditional,
          maxStacks,
          conditionDescription,
        })
      }
    }
  }

  // Handle multiplier notation (rare): 2.5x Combo Duration
  const multPattern =
    /(\d+(?:\.\d+)?)\s*x\s+([A-Za-z][A-Za-z\s]*?)(?:\.|$|\n|,)/g

  while ((match = multPattern.exec(statString)) !== null) {
    const value = parseFloat(match[1])
    const statName = match[2].trim().toLowerCase()

    const statType = STAT_NAME_MAP[statName]
    if (statType) {
      results.push({
        type: statType,
        value,
        operation: "percent_mult",
        isConditional,
        maxStacks,
        conditionDescription,
      })
    }
  }

  return results
}

/**
 * Check if a mod affects a specific stat type
 */
export function modAffectsStat(mod: PlacedMod, statType: StatType): boolean {
  const stats = parseModStats(mod)
  return stats.some((s) => s.type === statType)
}

/**
 * Get all stat types affected by a mod
 */
export function getModAffectedStats(mod: PlacedMod): StatType[] {
  const stats = parseModStats(mod)
  return [...new Set(stats.map((s) => s.type))]
}

/**
 * Check if a mod has any conditional effects
 */
export function hasConditionalEffects(mod: PlacedMod): boolean {
  const stats = parseModStats(mod)
  return stats.some((s) => s.isConditional)
}

/**
 * Get the max stacks for a conditional mod
 */
export function getMaxStacks(mod: PlacedMod): number | undefined {
  const stats = parseModStats(mod)
  const conditional = stats.find((s) => s.maxStacks)
  return conditional?.maxStacks
}
