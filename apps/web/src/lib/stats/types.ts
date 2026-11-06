import type { DamageTypes } from "@arsenyx/shared/warframe/types"

export type StatType =
  | "health"
  | "shield"
  | "armor"
  | "energy"
  | "sprint_speed"
  | "ability_strength"
  | "ability_duration"
  | "ability_efficiency"
  | "ability_range"
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
  | "impact"
  | "puncture"
  | "slash"
  | "heat"
  | "cold"
  | "electricity"
  | "toxin"
  | "blast"
  | "radiation"
  | "gas"
  | "magnetic"
  | "viral"
  | "corrosive"
  | "tau_resistance"
  | "status_duration"
  | "damage_vs_grineer"
  | "damage_vs_corpus"
  | "damage_vs_infested"
  | "damage_vs_corrupted"
  | "damage_vs_sentient"
  | "projectile_speed"
  | "ammo_max"
  | "zoom"
  | "recoil"
  | "finisher_damage"
  | "slide_attack"
  | "channeling"

export type DamageType = keyof DamageTypes

/** `base_add` raises the weapon's base value before mods multiply it
 *  (Incarnon "+X Base …" perks). */
type StatOperation = "flat_add" | "percent_add" | "base_add"

export interface ParsedStat {
  type: StatType
  value: number
  operation: StatOperation
  damageType?: DamageType
  isConditional?: boolean
  maxStacks?: number
  condition?: ConditionLabel
}

export type ConditionLabel =
  | "On Kill"
  | "On Hit"
  | "When Damaged"
  | "After Reload"
  | "After Headshot"

export interface StatContribution {
  name: string
  amount: number
  operation: "percent_add" | "flat_add"
  /** Optional sub-group label (e.g. "Base Damage", "Cold", "Toxin") for
   * stats that compose from multiple multiplicative/additive factors. */
  group?: string
}

export interface StatValue {
  base: number
  modified: number
  /** Pre-cap value, present only when a cap was applied. */
  uncapped?: number
  contributions: StatContribution[]
}

export interface DamageEntry {
  type: DamageType
  value: number
  base: number
  contributions: StatContribution[]
}

export interface DamageBreakdown {
  physical: DamageEntry[]
  elemental: DamageEntry[]
}

export interface AttackModeStats {
  name: string
  totalDamage: StatValue
  criticalChance: StatValue
  criticalMultiplier: StatValue
  statusChance: StatValue
  fireRate: StatValue
  magazineSize?: StatValue
  reloadTime?: StatValue
  range?: StatValue
  damageBreakdown: DamageBreakdown
}

export interface WeaponStats {
  attackModes: AttackModeStats[]
  multishot: StatValue
}

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
  DT_EXPLOSION_COLOR: "blast",
  DT_RADIATION_COLOR: "radiation",
  // The game calls Void damage "radiant" in description tokens.
  DT_RADIANT_COLOR: "void",
  DT_GAS_COLOR: "gas",
  DT_MAGNETIC_COLOR: "magnetic",
  DT_VIRAL_COLOR: "viral",
  DT_CORROSIVE_COLOR: "corrosive",
  DT_VOID_COLOR: "void",
  DT_SENTIENT: "tau",
  DT_SENTIENT_COLOR: "tau",
  DT_TAU_COLOR: "tau",
}

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

export const BASE_ELEMENTS: DamageType[] = [
  "heat",
  "cold",
  "electricity",
  "toxin",
]

export const COMBINED_ELEMENTS: DamageType[] = [
  "blast",
  "radiation",
  "gas",
  "magnetic",
  "viral",
  "corrosive",
]

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
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
  void: "Void",
  tau: "Tau",
}
