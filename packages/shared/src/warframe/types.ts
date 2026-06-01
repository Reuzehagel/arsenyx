// Warframe item types for browseable equipment

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
  | "railjack"

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
  aura?: string | string[]
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
  // Atmospheric (Archgun Deployer) damage profile, set only when it differs
  // from the default Archwing-mission profile.
  atmosphericDamage?: DamageTypes
  atmosphericTotalDamage?: number
  atmosphericAttacks?: Attack[]
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
  /**
   * Canonical stance compat-name for this melee (e.g. "Polearms"). Matches
   * stance mod `compatName` so the picker can filter stances per weapon.
   * Currently absent from upstream data — when populated, `getModsForItem`
   * filters stance mods; while missing, the picker shows every stance mod.
   */
  meleeClass?: string
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

// ---------------------------------------------------------------------------
// Modular weapon (Kitgun / Zaw) stat reconstruction data.
//
// DE ships modular component parts (kitgun chambers/grips/loaders, zaw
// strikes/grips/links) as zero-stat shells, so the real per-combination stats
// can't be read off the catalog. The wiki's `Module:Modular/data` is the only
// verifiable source; the build parses it into the shape below and emits it as
// `/data/modular.json` (see scripts/build/merge-modular.ts). The web stat
// panel reconstructs a chamber's stats from the selected grip + loader.
// ---------------------------------------------------------------------------

/** One reconstructed attack mode for a chamber+grip (damage keys lowercased,
 *  nonzero only). Keyed by `name` to the chamber's catalog attack modes. */
export interface ModularKitgunAttack {
  name: string
  damage: DamageTypes
}

/** A chamber's per-grip results: fire rate is grip-determined; damage is the
 *  flat per-grip total allocated across the chamber's attack modes. */
export interface ModularKitgunGrip {
  fireRate: number
  attacks: ModularKitgunAttack[]
}

export interface ModularKitgunChamber {
  /** Crit chance as a ratio (0.21 = 21%), before the loader's additive term. */
  critChance: number
  critMultiplier: number
  /** Status chance as a ratio, before the loader's additive term. */
  statusChance: number
  /** Magazine tier label ("High", "Med", …) → resolved size for this chamber. */
  magazine: Record<string, number>
  grips: Record<string, ModularKitgunGrip>
}

export interface ModularKitgunLoader {
  /** Additive crit-chance ratio applied on top of the chamber's base. */
  critChance: number
  critMultiplier: number
  statusChance: number
  reload: number
  /** Magazine tier label keyed into the chamber's `magazine` table. */
  magazine: string
}

export interface ModularKitguns {
  /** Chamber family ("Sporelacer") → stats, split by the grip's weapon class. */
  primary: Record<string, ModularKitgunChamber>
  secondary: Record<string, ModularKitgunChamber>
  /** Loaders are shared across both classes (identical modifiers). */
  loaders: Record<string, ModularKitgunLoader>
}

/** Zaw modifier tables, staged from the same wiki module for a future
 *  migration off the hand-maintained `zaw-data.ts` tables. Not yet consumed
 *  by the stat panel — the field semantics (esp. the two-handed multiplier)
 *  still need reconciling against the current zaw model before cutover. */
export interface ModularZawStrike {
  critChance: number
  critMultiplier: number
  statusChance: number
  speed: number
  damage: DamageTypes
  oneHanded: string
  twoHanded: string
}

export interface ModularZawGrip {
  damage: number
  speed: number
  twoHanded: boolean
}

export interface ModularZawLink {
  critChance: number
  statusChance: number
  damage: number
  speed: number
}

export interface ModularZaws {
  strikes: Record<string, ModularZawStrike>
  grips: Record<string, ModularZawGrip>
  links: Record<string, ModularZawLink>
}

export interface ModularData {
  kitgun: ModularKitguns
  zaw: ModularZaws
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
  /** Wiki Class label ("Sniper Rifle", "Polearm", "Warframe"). This is what
   *  appears as the class label in the UI, not a category enum. */
  displayClass?: string
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
  /** Augment routing: closed list of catalog item `uniqueName` values
   *  this mod fits. Set by `build-items-index.ts` from OpenWF's `compat`
   *  field after expanding BaseSuit anchors to their family of frames
   *  (Excalibur / ExcaliburPrime / ExcaliburUmbra share one entry).
   *  Absent on non-augment mods — runtime treats missing as "no
   *  restriction". See `getModsForItem`. */
  compatItems?: string[]
  /** OpenWF tag refinement (see `getModsForItem`). `compatTags`: the item
   *  must have at least one (e.g. `["SEMI_AUTO"]` — Semi-Rifle Cannonade only
   *  fits semi-auto weapons). `incompatTags`: the item must have none (e.g.
   *  `["GRNBOW"]` — Split Flights excludes Grineer bows like the Kuva Bramma).
   *  Refined against the weapon's own `compatTags`. */
  compatTags?: string[]
  incompatTags?: string[]
  type: string // e.g., "Warframe Mod", "Primary Mod", "Secondary Mod", "Melee Mod"
  tradable: boolean
  isAugment?: boolean
  isPrime?: boolean
  isExilus?: boolean
  isUtility?: boolean // Also indicates exilus-compatible mods in the source data
  /** True for PvP-only mods (description mentions Conclave). The mod-picker
   *  filters these by default — see the Game Mode toggle in
   *  `mod-search-grid.tsx`. */
  isConclave?: boolean
  levelStats?: Array<{ stats: string[] }>
  modSet?: string
  modSetStats?: string[]
  rivenStats?: RivenStats
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
  /** Effect bucket from DE's sub-path: "Offensive" | "Defensive" | "Utility"
   *  | "Zariman" | "Amp" | "Operator". NOT an equip slot. */
  type: string
  /** Equip slot from the wiki's `Type` field: "Warframe" | "Primary" |
   *  "Secondary" | "Melee" | "Bow" | "Shotgun" | "Kitgun" | "Zaw" | "Amp" |
   *  "Operator" | "Tektolyst Artifacts". Drives slot eligibility. */
  slotType?: string
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

export type SlotType = "aura" | "exilus" | "stance" | "normal" | "arcane"

export interface ModSlot {
  id: string
  type: SlotType
  innatePolarity?: Polarity
  formaPolarity?: Polarity // User-applied forma polarity
  mod?: PlacedMod
}

export interface RivenStatEntry {
  stat: string
  value: number
}

export interface RivenStats {
  positives: RivenStatEntry[]
  negatives: RivenStatEntry[]
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
  isUtility?: boolean // Also indicates exilus-compatible mods in the source data
  rivenStats?: RivenStats
}

export interface PlacedArcane {
  uniqueName: string
  name: string
  imageName?: string
  rank: number
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
  stanceSlot?: ModSlot
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

  // Zaw component selection (Zaw melee weapons only).
  // Strike is derived from the build's item — it's not stored here.
  zawComponents?: {
    grip: string
    link: string
  }

  // Kitgun component selection (Kitgun primary/secondary only).
  // Chamber is derived from the build's item — it's not stored here.
  kitgunComponents?: {
    grip: string
    loader: string
  }

  // Bonus element on Kuva/Tenet/Coda weapons (maxLevelCap: 40).
  lichBonusElement?: LichBonusElement

  // Incarnon adapter installed + per-tier perk selections (incarnon weapons
  // only). `incarnonPerks[i]` is the picked perk name for tier i+1, or null.
  // Index 0 (tier 1) is always null — tier 1 has no choice.
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]

  // Arch-Gun deployment context. Only meaningful for arch-guns with a
  // divergent atmospheric damage profile.
  deploymentContext?: DeploymentContext
}

export type DeploymentContext = "archwing" | "atmospheric"

export const DEFAULT_DEPLOYMENT_CONTEXT: DeploymentContext = "atmospheric"

export const LICH_BONUS_ELEMENTS = [
  "Heat",
  "Cold",
  "Electricity",
  "Toxin",
  "Radiation",
  "Magnetic",
  "Impact",
] as const

export type LichBonusElement = (typeof LICH_BONUS_ELEMENTS)[number]

export interface HelminthAbility {
  uniqueName: string
  name: string
  imageName?: string
  source: string // "Helminth" or source Warframe name
  description?: string
}

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
