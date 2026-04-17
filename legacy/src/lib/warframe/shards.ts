// Archon Shard data and utilities
// Data sourced from Warframe Wiki: https://wiki.warframe.com/w/Archon_Shard

import type { ShardColor, ShardStat } from "./types"

// All available shard colors in display order
export const SHARD_COLORS: ShardColor[] = [
  "crimson",
  "amber",
  "azure",
  "topaz",
  "violet",
  "emerald",
]

// Color display names
export const SHARD_COLOR_NAMES: Record<ShardColor, string> = {
  crimson: "Crimson",
  amber: "Amber",
  azure: "Azure",
  topaz: "Topaz",
  violet: "Violet",
  emerald: "Emerald",
}

// Shard stats organized by color
// Values are based on Warframe wiki data
// Tauforged values are 1.5x base values
export const SHARD_STATS: Record<ShardColor, ShardStat[]> = {
  crimson: [
    {
      name: "Melee Critical Damage",
      baseValue: 25,
      tauforgedValue: 37.5,
      unit: "%",
    },
    {
      name: "Primary Status Chance",
      baseValue: 25,
      tauforgedValue: 37.5,
      unit: "%",
    },
    {
      name: "Secondary Critical Chance",
      baseValue: 25,
      tauforgedValue: 37.5,
      unit: "%",
    },
    { name: "Ability Strength", baseValue: 10, tauforgedValue: 15, unit: "%" },
    { name: "Ability Duration", baseValue: 10, tauforgedValue: 15, unit: "%" },
  ],
  amber: [
    { name: "Initial Energy", baseValue: 30, tauforgedValue: 45, unit: "%" },
    {
      name: "Health Orb Effectiveness",
      baseValue: 100,
      tauforgedValue: 150,
      unit: "%",
    },
    {
      name: "Energy Orb Effectiveness",
      baseValue: 50,
      tauforgedValue: 75,
      unit: "%",
    },
    { name: "Casting Speed", baseValue: 25, tauforgedValue: 37.5, unit: "%" },
    {
      name: "Parkour Velocity",
      baseValue: 15,
      tauforgedValue: 22.5,
      unit: "%",
    },
  ],
  azure: [
    { name: "Health", baseValue: 150, tauforgedValue: 225, unit: "" },
    { name: "Shield Capacity", baseValue: 150, tauforgedValue: 225, unit: "" },
    { name: "Energy Max", baseValue: 50, tauforgedValue: 75, unit: "" },
    { name: "Armor", baseValue: 150, tauforgedValue: 225, unit: "" },
    { name: "Health Regen", baseValue: 5, tauforgedValue: 7.5, unit: "/s" },
  ],
  topaz: [
    {
      name: "Blast Kill Health",
      baseValue: 1,
      tauforgedValue: 2,
      unit: " per kill",
    },
    {
      name: "Blast Kill Shields",
      baseValue: 5,
      tauforgedValue: 7.5,
      unit: " per kill",
    },
    {
      name: "Heat Kill Crit Chance",
      baseValue: 1,
      tauforgedValue: 1.5,
      unit: "% per kill",
    },
    {
      name: "Radiation Ability Damage",
      baseValue: 10,
      tauforgedValue: 15,
      unit: "%",
    },
  ],
  violet: [
    {
      name: "Electricity Ability Damage",
      baseValue: 10,
      tauforgedValue: 15,
      unit: "%",
    },
    {
      name: "Primary Electricity Damage",
      baseValue: 30,
      tauforgedValue: 45,
      unit: "%",
    },
    {
      name: "Melee Critical Damage (Energy)",
      baseValue: 25,
      tauforgedValue: 37.5,
      unit: "%",
    },
    { name: "Orb Conversion", baseValue: 20, tauforgedValue: 30, unit: "%" },
  ],
  emerald: [
    {
      name: "Toxin Status Damage",
      baseValue: 30,
      tauforgedValue: 45,
      unit: "%",
    },
    { name: "Toxin Heal on Hit", baseValue: 2, tauforgedValue: 3, unit: " HP" },
    {
      name: "Corrosion Ability Damage",
      baseValue: 10,
      tauforgedValue: 15,
      unit: "%",
    },
    { name: "Corrosion Max Stacks", baseValue: 2, tauforgedValue: 3, unit: "" },
  ],
}

// Wiki image URLs for each shard type
const SHARD_IMAGE_BASE = "https://wiki.warframe.com/images/thumb"

// Image URLs for each color (regular and tauforged)
const SHARD_IMAGES: Record<ShardColor, { regular: string; tauforged: string }> =
  {
    crimson: {
      regular: `${SHARD_IMAGE_BASE}/CrimsonArchonShard.png/64px-CrimsonArchonShard.png`,
      tauforged: `${SHARD_IMAGE_BASE}/TauforgedCrimsonArchonShard.png/64px-TauforgedCrimsonArchonShard.png`,
    },
    amber: {
      regular: `${SHARD_IMAGE_BASE}/AmberArchonShard.png/64px-AmberArchonShard.png`,
      tauforged: `${SHARD_IMAGE_BASE}/TauforgedAmberArchonShard.png/64px-TauforgedAmberArchonShard.png`,
    },
    azure: {
      regular: `${SHARD_IMAGE_BASE}/AzureArchonShard.png/64px-AzureArchonShard.png`,
      tauforged: `${SHARD_IMAGE_BASE}/TauforgedAzureArchonShard.png/64px-TauforgedAzureArchonShard.png`,
    },
    topaz: {
      regular: `${SHARD_IMAGE_BASE}/TopazArchonShard.png/64px-TopazArchonShard.png`,
      tauforged: `${SHARD_IMAGE_BASE}/TauforgedTopazArchonShard.png/64px-TauforgedTopazArchonShard.png`,
    },
    violet: {
      regular: `${SHARD_IMAGE_BASE}/VioletArchonShard.png/64px-VioletArchonShard.png`,
      tauforged: `${SHARD_IMAGE_BASE}/TauforgedVioletArchonShard.png/64px-TauforgedVioletArchonShard.png`,
    },
    emerald: {
      regular: `${SHARD_IMAGE_BASE}/EmeraldArchonShard.png/64px-EmeraldArchonShard.png`,
      tauforged: `${SHARD_IMAGE_BASE}/TauforgedEmeraldArchonShard.png/64px-TauforgedEmeraldArchonShard.png`,
    },
  }

/**
 * Get the image URL for a shard
 */
export function getShardImageUrl(
  color: ShardColor,
  tauforged: boolean,
): string {
  return tauforged ? SHARD_IMAGES[color].tauforged : SHARD_IMAGES[color].regular
}

/**
 * Get the stats available for a specific shard color
 */
export function getStatsForColor(color: ShardColor): ShardStat[] {
  return SHARD_STATS[color] ?? []
}

/**
 * Find a specific stat by name within a color
 */
export function findStat(
  color: ShardColor,
  statName: string,
): ShardStat | undefined {
  return SHARD_STATS[color]?.find((s) => s.name === statName)
}

/**
 * Get stat index for encoding (used in build codec)
 */
export function getStatIndex(color: ShardColor, statName: string): number {
  const stats = SHARD_STATS[color]
  if (!stats) return 0
  const index = stats.findIndex((s) => s.name === statName)
  return index >= 0 ? index : 0
}

/**
 * Get stat name from index (used in build codec decoding)
 */
export function getStatByIndex(color: ShardColor, index: number): string {
  const stats = SHARD_STATS[color]
  if (!stats || index < 0 || index >= stats.length)
    return stats?.[0]?.name ?? ""
  return stats[index].name
}

/**
 * Format a stat value for display
 */
export function formatStatValue(stat: ShardStat, tauforged: boolean): string {
  const value = tauforged ? stat.tauforgedValue : stat.baseValue
  const formattedValue = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(/\.0$/, "")
  return `+${formattedValue}${stat.unit}`
}

/**
 * Get the CSS color for a shard color
 */
export function getShardCssColor(color: ShardColor): string {
  const colors: Record<ShardColor, string> = {
    crimson: "#dc2626", // red-600
    amber: "#d97706", // amber-600
    azure: "#2563eb", // blue-600
    topaz: "#ea580c", // orange-600
    violet: "#7c3aed", // violet-600
    emerald: "#059669", // emerald-600
  }
  return colors[color]
}

/**
 * Get a lighter CSS color for shard backgrounds/glows
 */
export function getShardGlowColor(color: ShardColor): string {
  const colors: Record<ShardColor, string> = {
    crimson: "rgba(220, 38, 38, 0.3)",
    amber: "rgba(217, 119, 6, 0.3)",
    azure: "rgba(37, 99, 235, 0.3)",
    topaz: "rgba(234, 88, 12, 0.3)",
    violet: "rgba(124, 58, 237, 0.3)",
    emerald: "rgba(5, 150, 105, 0.3)",
  }
  return colors[color]
}
