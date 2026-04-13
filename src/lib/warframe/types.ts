// Warframe item types for browseable equipment
// Based on @wfcd/items type definitions

export type BrowseCategory =
  | "warframes"
  | "primary"
  | "secondary"
  | "melee"
  | "necramechs"
  | "companions"
  | "companion-weapons"
  | "exalted-weapons"
  | "archwing"

export type WfcdCategory =
  | "Warframes"
  | "Primary"
  | "Secondary"
  | "Melee"
  | "Sentinels"
  | "Pets"
  | "Archwing"
  | "Arch-Gun"
  | "Arch-Melee"

// Base item interface with common fields
export interface BaseItem {
  uniqueName: string
  name: string
  description?: string
  imageName?: string
  category?: string
  tradable: boolean
  masteryReq?: number
  buildPrice?: number
  buildTime?: number
  isPrime?: boolean
  vaulted?: boolean
  releaseDate?: string
  wikiaUrl?: string
  wikiaThumbnail?: string
}

// Warframe-specific fields
export interface Warframe extends BaseItem {
  health: number
  shield: number
  armor: number
  power: number
  sprintSpeed?: number
  abilities?: Ability[]
  aura?: string
  polarities?: string[]
  passiveDescription?: string
  sex?: "Male" | "Female"
  exalted?: string[]
}

export interface Ability {
  uniqueName: string
  name: string
  description: string
  imageName?: string
}

// Weapon base interface
export interface Weapon extends BaseItem {
  slot?: number
  totalDamage?: number
  fireRate?: number
  criticalChance?: number
  criticalMultiplier?: number
  procChance?: number
  accuracy?: number
  damage?: DamageTypes
  disposition?: number
  noise?: "Alarming" | "Silent"
  trigger?: string
  attacks?: Attack[]
  polarities?: string[]
}

export interface DamageTypes {
  impact?: number
  puncture?: number
  slash?: number
  heat?: number
  cold?: number
  electricity?: number
  toxin?: number
  blast?: number
  radiation?: number
  gas?: number
  magnetic?: number
  viral?: number
  corrosive?: number
  void?: number
  tau?: number
}

export interface Attack {
  name: string
  speed?: number
  crit_chance?: number
  crit_mult?: number
  status_chance?: number
  damage?: DamageTypes | string
}

// Gun-specific (Primary/Secondary)
export interface Gun extends Weapon {
  magazineSize?: number
  reloadTime?: number
  ammo?: number
  multishot?: number
  flight?: number | string
  projectile?: "Hitscan" | "Projectile" | "Thrown" | "Discharge"
}

// Melee-specific
export interface Melee extends Weapon {
  stancePolarity?: string
  blockingAngle?: number
  comboDuration?: number
  followThrough?: number
  range?: number
  slamAttack?: number
  slamRadialDamage?: number
  slamRadius?: number
  slideAttack?: number
  heavyAttackDamage?: number
  heavySlamAttack?: number
  heavySlamRadialDamage?: number
  heavySlamRadius?: number
  windUp?: number
}

// Necramech
export interface Necramech extends BaseItem {
  health: number
  shield: number
  armor: number
  abilities?: Ability[]
}

// Companion (Sentinels + Pets)
export interface Companion extends BaseItem {
  health?: number
  shield?: number
  armor?: number
  power?: number
  type?: string
}

// Union type for all browseable items
export type BrowseableItem = Warframe | Gun | Melee | Necramech | Companion

// Simplified item for grid display
export interface BrowseItem {
  uniqueName: string
  name: string
  slug: string
  category: BrowseCategory
  imageName?: string
  masteryReq?: number
  isPrime?: boolean
  vaulted?: boolean
  type?: string
  releaseDate?: string // Format: "YYYY-MM-DD"
}

// Sort options for browse page
export type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc"

// Filter options for browse page
export interface BrowseFilters {
  category: BrowseCategory
  query?: string
  masteryMax?: number
  primeOnly?: boolean
  hideVaulted?: boolean
  sort?: SortOption
}

// =============================================================================
// POLARITIES
// =============================================================================

export type Polarity =
  | "madurai"
  | "vazarin"
  | "naramon"
  | "zenurik"
  | "unairu"
  | "penjaga"
  | "umbra"
  | "any"
  | "universal"

// =============================================================================
// MOD TYPES
// =============================================================================

export interface Mod {
  uniqueName: string
  name: string
  description?: string
  imageName?: string
  polarity: Polarity
  rarity:
    | "Common"
    | "Uncommon"
    | "Rare"
    | "Legendary"
    | "Peculiar"
    | "Riven"
    | "Amalgam"
    | "Galvanized"
  baseDrain: number
  fusionLimit: number
  compatName?: string // e.g., "Warframe", "Rifle", "Shotgun", "Pistol", "Melee"
  type: string // e.g., "Warframe Mod", "Primary Mod", "Secondary Mod", "Melee Mod"
  tradable: boolean
  isAugment?: boolean
  isPrime?: boolean
  isExilus?: boolean
  isUtility?: boolean // Also indicates exilus-compatible mods in WFCD data
  levelStats?: Array<{ stats: string[] }>
  modSet?: string
  modSetStats?: string[]
  transmutable?: boolean
  stats?: string[]
  drops?: Array<{
    chance: number
    location: string
    rarity: string
    type: string
  }>
  wikiaThumbnail?: string
}

// =============================================================================
// ARCANE TYPES
// =============================================================================

export interface Arcane {
  uniqueName: string
  name: string
  description?: string
  imageName?: string
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary"
  type: string
  tradable: boolean
  levelStats?: Array<{ stats: string[] }>
  drops?: Array<{
    chance: number
    location: string
    rarity: string
    type: string
  }>
}

// =============================================================================
// BUILD STATE TYPES
// =============================================================================

export type SlotType = "aura" | "exilus" | "normal" | "arcane"

export interface ModSlot {
  id: string
  type: SlotType
  innatePolarity?: Polarity
  formaPolarity?: Polarity // User-applied forma polarity
  mod?: PlacedMod
}

export interface PlacedMod {
  uniqueName: string
  name: string
  imageName?: string
  polarity: Polarity
  baseDrain: number
  fusionLimit: number
  rank: number // Current rank (0 to fusionLimit)
  rarity: string
  compatName?: string
  type?: string
  levelStats?: Array<{ stats: string[] }>
  modSet?: string
  modSetStats?: string[]
  isExilus?: boolean
  isUtility?: boolean // Also indicates exilus-compatible mods in WFCD data
}

export interface PlacedArcane {
  uniqueName: string
  name: string
  imageName?: string
  rank: number
  rarity?: string
}

export interface BuildState {
  // Item info
  itemUniqueName: string
  itemName: string
  itemCategory: BrowseCategory
  itemImageName?: string

  // Enhancement status
  hasReactor: boolean // Orokin Reactor (Warframe) or Catalyst (Weapon)

  // Mod slots
  auraSlots: ModSlot[] // Warframes: 1 slot (2 for Jade)
  exilusSlot?: ModSlot
  normalSlots: ModSlot[] // 8 slots (12 for Necramechs)
  arcaneSlots: (PlacedArcane | null)[] // Warframes: 2 slots, Weapons: 1 slot

  // Archon Shards (Warframes only) - 5 slots
  shardSlots: (PlacedShard | null)[]

  // Capacity tracking
  maxLevelCap?: number // 30 default, 40 for Kuva/Tenet/Coda weapons
  baseCapacity: number // 30 base, 60 with reactor (80 for maxLevelCap 40)
  currentCapacity: number // Remaining after mods

  // Metadata
  buildName?: string
  createdAt?: string
  updatedAt?: string

  // Forma tracking (computed from slot polarity changes)
  formaCount: number

  // Helminth ability replacement (only for warframes)
  helminthAbility?: {
    slotIndex: number // 0-3, which ability slot was replaced
    ability: HelminthAbility
  }
}

export interface HelminthAbility {
  uniqueName: string
  name: string
  imageName?: string
  source: string // "Helminth" or source Warframe name
  description?: string
}

// Mod compatibility categories for filtering
export type ModCompatibility =
  | "Warframe"
  | "Aura"
  | "Exilus"
  | "Rifle"
  | "Shotgun"
  | "Pistol"
  | "Melee"
  | "Companion"
  | "Archwing"
  | "Archgun"
  | "Archmelee"
  | "Necramech"

// =============================================================================
// ARCHON SHARD TYPES
// =============================================================================

export type ShardColor =
  | "crimson"
  | "amber"
  | "azure"
  | "topaz"
  | "violet"
  | "emerald"

export interface ShardStat {
  name: string // e.g., "Health", "Ability Strength"
  baseValue: number // Regular shard bonus
  tauforgedValue: number // Tauforged bonus (+50%)
  unit: string // "", "%", "s", etc.
}

export interface PlacedShard {
  color: ShardColor
  stat: string // Stat name key
  tauforged: boolean
}

// ---------------------------------------------------------------------------
// Item Stats (extracted from browseable item data for display)
// ---------------------------------------------------------------------------

export interface ItemStats {
  health?: number
  shield?: number
  armor?: number
  energy?: number
  sprintSpeed?: number
  abilities?: Array<{ name: string; imageName?: string; description: string }>
  fireRate?: number
  criticalChance?: number
  criticalMultiplier?: number
  procChance?: number
  totalDamage?: number
  magazineSize?: number
  reloadTime?: number
  range?: number
  comboDuration?: number
}
