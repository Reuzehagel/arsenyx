// Stat calculation types for real-time build stats

// All stat types that can be affected by mods
export type StatType =
  // Warframe base stats
  | "health"
  | "shield"
  | "armor"
  | "energy"
  | "sprint_speed"
  // Warframe ability stats (percentage-based, 100% = base)
  | "ability_strength"
  | "ability_duration"
  | "ability_efficiency"
  | "ability_range"
  // Weapon base stats
  | "damage"
  | "critical_chance"
  | "critical_multiplier"
  | "status_chance"
  | "fire_rate"
  | "magazine_size"
  | "reload_speed"
  | "multishot"
  | "punch_through"
  | "range"
  | "combo_duration"
  // Physical damage types (IPS)
  | "impact"
  | "puncture"
  | "slash"
  // Elemental damage types
  | "heat"
  | "cold"
  | "electricity"
  | "toxin"
  // Combined elemental types
  | "blast"
  | "radiation"
  | "gas"
  | "magnetic"
  | "viral"
  | "corrosive"
  // Special
  | "tau_resistance"
  | "melee_damage"

// Damage types for weapons
export type DamageType =
  // Physical
  | "impact"
  | "puncture"
  | "slash"
  // Base elemental
  | "heat"
  | "cold"
  | "electricity"
  | "toxin"
  // Combined elemental
  | "blast"
  | "radiation"
  | "gas"
  | "magnetic"
  | "viral"
  | "corrosive"
  // Special
  | "void"
  | "tau"

// How a stat modifier is applied
export type StatOperation = "flat_add" | "percent_add" | "percent_mult"

// A single parsed stat effect from a mod
export interface ParsedStat {
  type: StatType
  value: number
  operation: StatOperation
  damageType?: DamageType // For elemental mods
  isConditional?: boolean // For Galvanized, on-kill mods
  maxStacks?: number // For stackable effects
  conditionDescription?: string // e.g., "On Kill"
}

// Contribution from a single source (mod, shard, set bonus, aura)
export interface StatContribution {
  source: "mod" | "shard" | "set_bonus" | "aura"
  name: string // Mod name or "Archon Shard"
  absoluteValue: number // Actual contribution amount
  percentOfBonus: number // Percentage of total bonus (for tooltip)
}

// A calculated stat value with breakdown
export interface StatValue {
  base: number
  modified: number
  capped?: number // If stat has a cap and was exceeded
  contributions: StatContribution[]
}

// Physical damage (IPS) breakdown
export interface PhysicalDamage {
  impact?: number
  puncture?: number
  slash?: number
}

// Elemental damage entry
export interface ElementalDamage {
  type: DamageType
  value: number
  sources?: string[] // Which mods/effects created this element
}

// Full damage breakdown for weapons
export interface DamageBreakdown {
  physical: PhysicalDamage
  elemental: ElementalDamage[]
}

// Stats for a single attack mode (primary fire, alt fire, etc.)
export interface AttackModeStats {
  name: string // "Primary Fire", "Alt Fire", "Charged Shot"
  totalDamage: StatValue
  criticalChance: StatValue
  criticalMultiplier: StatValue
  statusChance: StatValue
  effectiveStatusChance?: StatValue // For multi-pellet weapons
  fireRate: StatValue
  magazineSize?: StatValue
  reloadTime?: StatValue
  range?: StatValue
  damageBreakdown: DamageBreakdown
}

// Warframe-specific calculated stats
export interface WarframeStats {
  health: StatValue
  shield: StatValue
  armor: StatValue
  energy: StatValue
  sprintSpeed: StatValue
  abilityStrength: StatValue
  abilityDuration: StatValue
  abilityEfficiency: StatValue
  abilityRange: StatValue
}

// Weapon-specific calculated stats
export interface WeaponStats {
  attackModes: AttackModeStats[]
  multishot: StatValue
}

// Top-level calculated stats object
export interface CalculatedStats {
  warframe?: WarframeStats
  weapon?: WeaponStats
}

// Mapping from WFCD color tags to damage types
export const DAMAGE_TYPE_COLORS: Record<string, DamageType> = {
  DT_IMPACT_COLOR: "impact",
  DT_PUNCTURE_COLOR: "puncture",
  DT_SLASH_COLOR: "slash",
  DT_FIRE_COLOR: "heat",
  DT_HEAT_COLOR: "heat",
  DT_COLD_COLOR: "cold",
  DT_FREEZE_COLOR: "cold",
  DT_ELECTRICITY_COLOR: "electricity",
  DT_ELECTRIC_COLOR: "electricity",
  DT_POISON_COLOR: "toxin",
  DT_TOXIN_COLOR: "toxin",
  DT_BLAST_COLOR: "blast",
  DT_RADIATION_COLOR: "radiation",
  DT_GAS_COLOR: "gas",
  DT_MAGNETIC_COLOR: "magnetic",
  DT_VIRAL_COLOR: "viral",
  DT_CORROSIVE_COLOR: "corrosive",
  DT_VOID_COLOR: "void",
  DT_SENTIENT: "tau",
  DT_TAU_COLOR: "tau",
}

// Display names for stats
export const STAT_DISPLAY_NAMES: Partial<Record<StatType, string>> = {
  health: "Health",
  shield: "Shield",
  armor: "Armor",
  energy: "Energy",
  sprint_speed: "Sprint Speed",
  ability_strength: "Strength",
  ability_duration: "Duration",
  ability_efficiency: "Efficiency",
  ability_range: "Range",
  damage: "Damage",
  critical_chance: "Critical Chance",
  critical_multiplier: "Critical Multiplier",
  status_chance: "Status Chance",
  fire_rate: "Fire Rate",
  magazine_size: "Magazine",
  reload_speed: "Reload Time",
  multishot: "Multishot",
  punch_through: "Punch Through",
  range: "Range",
  combo_duration: "Combo Duration",
  impact: "Impact",
  puncture: "Puncture",
  slash: "Slash",
  heat: "Heat",
  cold: "Cold",
  electricity: "Electricity",
  toxin: "Toxin",
  blast: "Blast",
  radiation: "Radiation",
  gas: "Gas",
  magnetic: "Magnetic",
  viral: "Viral",
  corrosive: "Corrosive",
  tau_resistance: "Tau Resistance",
  melee_damage: "Melee Damage",
}

// Elemental combination rules (order matters in-game, but we just track what combines)
export const ELEMENTAL_COMBINATIONS: Record<string, DamageType> = {
  "heat+cold": "blast",
  "cold+heat": "blast",
  "heat+electricity": "radiation",
  "electricity+heat": "radiation",
  "heat+toxin": "gas",
  "toxin+heat": "gas",
  "cold+electricity": "magnetic",
  "electricity+cold": "magnetic",
  "cold+toxin": "viral",
  "toxin+cold": "viral",
  "electricity+toxin": "corrosive",
  "toxin+electricity": "corrosive",
}

// Base elemental types that can combine
export const BASE_ELEMENTS: DamageType[] = [
  "heat",
  "cold",
  "electricity",
  "toxin",
]

// Combined elemental types
export const COMBINED_ELEMENTS: DamageType[] = [
  "blast",
  "radiation",
  "gas",
  "magnetic",
  "viral",
  "corrosive",
]
