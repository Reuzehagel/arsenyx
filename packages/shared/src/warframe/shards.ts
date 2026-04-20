import type { ShardColor, ShardStat } from "./types"

export const SHARD_COLORS: ShardColor[] = [
  "crimson",
  "amber",
  "azure",
  "topaz",
  "violet",
  "emerald",
]

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

export function getStatIndex(color: ShardColor, statName: string): number {
  const stats = SHARD_STATS[color]
  if (!stats) return 0
  const index = stats.findIndex((s) => s.name === statName)
  return index >= 0 ? index : 0
}

export function getStatByIndex(color: ShardColor, index: number): string {
  const stats = SHARD_STATS[color]
  if (!stats || index < 0 || index >= stats.length)
    return stats?.[0]?.name ?? ""
  return stats[index].name
}
