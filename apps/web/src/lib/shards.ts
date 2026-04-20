export type ShardColor =
  | "crimson"
  | "amber"
  | "azure"
  | "topaz"
  | "violet"
  | "emerald"

export interface ShardStat {
  name: string
  baseValue: number
  tauforgedValue: number
  unit: string
}

export interface PlacedShard {
  color: ShardColor
  stat: string
  tauforged: boolean
}

export const SHARD_COLORS: ShardColor[] = [
  "crimson",
  "amber",
  "azure",
  "topaz",
  "violet",
  "emerald",
]

export const SHARD_COLOR_NAMES: Record<ShardColor, string> = {
  crimson: "Crimson",
  amber: "Amber",
  azure: "Azure",
  topaz: "Topaz",
  violet: "Violet",
  emerald: "Emerald",
}

export const SHARD_CSS_COLORS: Record<ShardColor, string> = {
  crimson: "#dc2626",
  amber: "#d97706",
  azure: "#2563eb",
  topaz: "#ea580c",
  violet: "#7c3aed",
  emerald: "#059669",
}

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

const SHARD_IMAGE_BASE = "https://wiki.warframe.com/images/thumb"
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

export const SHARD_SLOT_COUNT = 5

export function padShards(
  saved: (PlacedShard | null)[] | undefined,
  length = SHARD_SLOT_COUNT,
): (PlacedShard | null)[] {
  const out: (PlacedShard | null)[] = Array.from({ length }, () => null)
  const input = saved ?? []
  for (let i = 0; i < Math.min(length, input.length); i++) {
    out[i] = input[i] ?? null
  }
  return out
}

export function getShardImageUrl(
  color: ShardColor,
  tauforged: boolean,
): string {
  return tauforged ? SHARD_IMAGES[color].tauforged : SHARD_IMAGES[color].regular
}

export function findShardStat(
  color: ShardColor,
  statName: string,
): ShardStat | undefined {
  return SHARD_STATS[color]?.find((s) => s.name === statName)
}

export function formatStatValue(stat: ShardStat, tauforged: boolean): string {
  const v = tauforged ? stat.tauforgedValue : stat.baseValue
  const f = Number.isInteger(v)
    ? v.toString()
    : v.toFixed(1).replace(/\.0$/, "")
  return `+${f}${stat.unit}`
}

/** Stat-name → warframe base-stat key, for flat bonuses (unit === ""). */
const AZURE_MAP: Record<string, "health" | "shield" | "armor" | "energy"> = {
  Health: "health",
  "Shield Capacity": "shield",
  Armor: "armor",
  "Energy Max": "energy",
}

export interface ShardStatBonuses {
  health: number
  shield: number
  armor: number
  energy: number
}

export function sumShardFlatBonuses(
  shards: (PlacedShard | null)[],
): ShardStatBonuses {
  const out: ShardStatBonuses = { health: 0, shield: 0, armor: 0, energy: 0 }
  for (const s of shards) {
    if (!s) continue
    const key = AZURE_MAP[s.stat]
    if (!key) continue
    const stat = findShardStat(s.color, s.stat)
    if (!stat || stat.unit !== "") continue
    out[key] += s.tauforged ? stat.tauforgedValue : stat.baseValue
  }
  return out
}
