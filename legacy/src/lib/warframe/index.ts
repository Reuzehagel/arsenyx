// Warframe data utilities
// NOTE: items.ts uses @wfcd/items which requires Node.js fs module
// Import items.ts directly in server components only

// Client-safe exports (no Node.js dependencies)

// types
export type {
  BrowseCategory,
  WfcdCategory,
  BaseItem,
  Warframe,
  Ability,
  Weapon,
  DamageTypes,
  Attack,
  Gun,
  Melee,
  Necramech,
  Companion,
  BrowseableItem,
  BrowseItem,
  SortOption,
  BrowseFilters,
  Polarity,
  Mod,
  Arcane,
  SlotType,
  ModSlot,
  PlacedMod,
  PlacedArcane,
  BuildState,
  HelminthAbility,
  ModCompatibility,
  ShardColor,
  ShardStat,
  PlacedShard,
  ItemStats,
} from "./types"

// categories
export type { CategoryConfig } from "./categories"
export {
  BROWSE_CATEGORIES,
  getCategoryConfig,
  getCategoryByWfcd,
  getDefaultCategory,
  isValidCategory,
  mapWfcdCategory,
  isWarframeCategory,
  isWeaponCategory,
  isGunCategory,
  isMeleeCategory,
  isCompanionCategory,
  isExaltedWeaponCategory,
  isCompanionWeaponCategory,
  isArchwingCategory,
} from "./categories"

// formatting
export type { StatFormat } from "./formatting"
export { formatDisplayValue, formatContribution, formatPercent } from "./formatting"

// images
export { getImageUrl, getPlaceholderUrl, getImageProps, getPreloadImageUrl } from "./images"

// arcane-images
export { getArcaneImageUrl, getArcanePlaceholderUrl } from "./arcane-images"

// slugs
export { slugify, unslugify, getItemUrl, normalizeCategory } from "./slugs"

// shards
export {
  SHARD_COLORS,
  SHARD_COLOR_NAMES,
  SHARD_STATS,
  getShardImageUrl,
  getStatsForColor,
  findStat,
  getStatIndex,
  getStatByIndex,
  formatStatValue,
  getShardCssColor,
  getShardGlowColor,
} from "./shards"

// mod-card-config
export type { ModRarity, RarityGroup, CardVariant } from "./mod-card-config"
export {
  RARITY_CONFIG,
  ASSET_DIMENSIONS,
  DISPLAY_SIZE,
  getModAssetUrl,
  getRarityColor,
  getRarityGroup,
  getPolarityIconUrl,
} from "./mod-card-config"

// mod-variants
export { getModBaseName, areModsVariants } from "./mod-variants"

// Stats calculation system (client-safe)

// stat-types
export type {
  StatType,
  DamageType,
  StatOperation,
  ParsedStat,
  StatContribution,
  StatValue,
  PhysicalDamage,
  ElementalDamage,
  DamageBreakdown,
  AttackModeStats,
  WarframeStats,
  WeaponStats,
  CalculatedStats,
} from "./stat-types"
export {
  DAMAGE_TYPE_COLORS,
  STAT_DISPLAY_NAMES,
  ELEMENTAL_COMBINATIONS,
  BASE_ELEMENTS,
  COMBINED_ELEMENTS,
} from "./stat-types"

// stat-caps
export type { CappedStatResult } from "./stat-caps"
export { STAT_CAPS, applyStatCap, hasStatCap, getStatCap } from "./stat-caps"

// stat-parser
export {
  parseModStats,
  parseStatString,
  modAffectsStat,
  getModAffectedStats,
  hasConditionalEffects,
  getMaxStacks,
} from "./stat-parser"

// aura-effects
export {
  SELF_AFFECTING_AURAS,
  EXCLUDED_AURAS,
  isAuraSelfAffecting,
  getAuraStats,
  getAuraMaxValue,
} from "./aura-effects"

// stats
export {
  calculateStats,
  calculateWarframeStats,
  calculateWeaponStats,
  buildHasConditionalMods,
} from "./stats"

// Server-only exports should be imported directly:
// import { getItemsByCategory, ... } from "@/lib/warframe/items";
// import { getAllMods, ... } from "@/lib/warframe/mods";
