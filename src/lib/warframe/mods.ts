// Mods and Arcanes service - server-only, imports JSON directly
// Data files are copied from @wfcd/items/data/json/ to src/data/warframe/

import ArcanesData from "@/data/warframe/Arcanes.json"
import ModsData from "@/data/warframe/Mods.json"

import type {
  Mod,
  Arcane,
  Polarity,
  ModCompatibility,
  HelminthAbility,
} from "./types"

// Type assertion for imported data
const allMods = ModsData as unknown as Mod[]
const allArcanes = ArcanesData as unknown as Arcane[]

// Caches to avoid re-normalizing large mod lists on every call
let cachedAllMods: Mod[] | null = null
let cachedAllArcanes: Arcane[] | null = null
const cachedModsByCompat = new Map<ModCompatibility, Mod[]>()
const cachedArcanesBySlot = new Map<string, Arcane[]>()
let modByUniqueNameMap: Map<string, Mod> | null = null
let arcaneByUniqueNameMap: Map<string, Arcane> | null = null

// =============================================================================
// POLARITY UTILITIES
// =============================================================================

/**
 * Normalize polarity string from WFCD data to our Polarity type
 */
export function normalizePolarity(polarity?: string): Polarity {
  if (!polarity) return "universal"
  const lower = polarity.toLowerCase()

  const polarityMap: Record<string, Polarity> = {
    madurai: "madurai",
    vazarin: "vazarin",
    naramon: "naramon",
    zenurik: "zenurik",
    unairu: "unairu",
    penjaga: "penjaga",
    umbra: "umbra",
    any: "any",
    universal: "universal",
    // Alternative names
    d: "vazarin",
    r: "madurai",
    dash: "naramon",
    v: "madurai",
  }

  return polarityMap[lower] ?? "universal"
}

// =============================================================================
// MOD QUERIES
// =============================================================================

/**
 * Get all mods from the data
 */
export function getAllMods(): Mod[] {
  if (cachedAllMods) return cachedAllMods

  // Pre-index mod sets by uniqueName for O(1) lookup during mapping
  const modSetIndex = new Map<string, Mod>()
  for (const mod of allMods) {
    if (mod.uniqueName && mod.stats) {
      modSetIndex.set(mod.uniqueName, mod)
    }
  }

  cachedAllMods = allMods
    .filter((mod) => {
      // Filter out Riven mods and other special cases
      if (!mod.name) return false
      if (mod.name.includes("Riven Mod")) return false
      if (!mod.compatName && !mod.type) return false

      // Filter out Conclave/PvP mods
      const uniqueName = mod.uniqueName ?? ""
      if (uniqueName.includes("/PvPMods/")) return false

      // Filter out variant mods (duplicates with different stats)
      // - Beginner: Tutorial versions with lower ranks (in /Beginner/ path)
      // - Intermediate: Mid-tier tutorial versions (ends with "Intermediate")
      // - Expert: Higher-rank duplicates (ends with "Expert") BUT keep if name contains "Primed"
      //           because Primed mods are stored with Expert suffix in WFCD data
      // - Nemesis: Duplicate entries from Nemesis system
      // - SubMod: Internal sub-components of other mods (ends with "SubMod")
      if (uniqueName.includes("/Beginner/")) return false
      if (uniqueName.endsWith("Intermediate")) return false
      // Expert mods are duplicates UNLESS they're Primed mods (Primed versions use Expert suffix)
      if (uniqueName.endsWith("Expert") && !mod.name.includes("Primed"))
        return false
      if (uniqueName.includes("/Nemesis/")) return false
      if (uniqueName.endsWith("SubMod")) return false

      return true
    })
    .map((mod) => {
      // Find set bonus stats if applicable (uses pre-built index for O(1) lookup)
      let modSetStats: string[] | undefined
      if (mod.modSet) {
        const setMod = modSetIndex.get(mod.modSet)
        if (setMod && setMod.stats) {
          modSetStats = setMod.stats
        }
      }

      // Transform rarity for Amalgam and Galvanized mods
      // WFCD data has these as "Rare" but they need special rarity for frame rendering
      let rarity = mod.rarity
      if (mod.name.startsWith("Amalgam ")) {
        rarity = "Amalgam"
      } else if (mod.name.startsWith("Galvanized ")) {
        rarity = "Galvanized"
      }

      return {
        ...mod,
        polarity: normalizePolarity(mod.polarity as unknown as string),
        modSetStats,
        rarity,
      }
    })

  return cachedAllMods
}

/**
 * Get mods by compatibility category (e.g., "Warframe", "Rifle", "Melee")
 */
export function getModsByCompatibility(compatibility: ModCompatibility): Mod[] {
  const cached = cachedModsByCompat.get(compatibility)
  if (cached) return cached

  const allModsNormalized = getAllMods()

  const filtered = allModsNormalized.filter((mod) => {
    const compatName = mod.compatName?.toLowerCase() ?? ""
    const modType = mod.type?.toLowerCase() ?? ""

    switch (compatibility) {
      case "Warframe":
        // Include general warframe mods (compatName is "WARFRAME") and aura mods
        // Exclude warframe-specific augments (where compatName is a specific warframe name like "Trinity")
        return (
          modType.includes("warframe") &&
          (compatName === "warframe" || compatName === "aura")
        )
      case "Aura":
        return modType.includes("aura") || compatName === "aura"
      case "Exilus":
        // Both isExilus and isUtility indicate exilus-compatible mods in WFCD data
        return mod.isExilus === true || mod.isUtility === true
      case "Rifle":
        return compatName === "rifle" || modType.includes("rifle")
      case "Shotgun":
        return compatName === "shotgun" || modType.includes("shotgun")
      case "Pistol":
        return compatName === "pistol" || modType.includes("secondary")
      case "Melee":
        return compatName === "melee" || modType.includes("melee")
      case "Companion":
        return (
          modType.includes("companion") ||
          modType.includes("sentinel") ||
          modType.includes("beast")
        )
      case "Necramech":
        return modType.includes("necramech")
      case "Archgun":
        return compatName === "archgun" || modType.includes("arch-gun")
      case "Archmelee":
        return compatName === "archmelee" || modType.includes("arch-melee")
      case "Archwing":
        return compatName === "archwing" || modType.includes("archwing")
      default:
        return false
    }
  })

  cachedModsByCompat.set(compatibility, filtered)
  return filtered
}

/**
 * Get mods compatible with a browse category
 */
export function getModsForCategory(category: string): Mod[] {
  const categoryMap: Record<string, ModCompatibility[]> = {
    warframes: ["Warframe"],
    primary: ["Rifle", "Shotgun"],
    secondary: ["Pistol"],
    melee: ["Melee"],
    "exalted-weapons": ["Rifle", "Pistol", "Melee"],
    necramechs: ["Necramech"],
    companions: ["Companion"],
    archwing: ["Archwing", "Archgun", "Archmelee"],
  }

  const compatibilities = categoryMap[category]
  if (!compatibilities) return []

  const result: Mod[] = []
  for (const compat of compatibilities) {
    result.push(...getModsByCompatibility(compat))
  }
  return result
}

// Shared mod-matching helpers used by both standard weapons and exalted weapons
function isPrimaryMod(compatName: string, modType: string, subtype: string) {
  if (compatName === subtype) return true
  if (modType.includes(subtype)) return true
  // General primary mods (no specific weapon type in compatName)
  if (
    modType.includes("primary") &&
    !compatName &&
    !modType.includes("rifle") &&
    !modType.includes("shotgun") &&
    !modType.includes("sniper") &&
    !modType.includes("launcher") &&
    !modType.includes("bow")
  ) {
    return true
  }
  return false
}

function isPistolMod(compatName: string, modType: string) {
  return (
    compatName === "pistol" ||
    modType.includes("secondary") ||
    modType.includes("pistol")
  )
}

function isMeleeMod(compatName: string, modType: string) {
  return compatName === "melee" || modType.includes("melee")
}

const PRIMARY_SUBTYPES = ["rifle", "shotgun", "sniper", "launcher", "bow"]

/**
 * Get mods compatible with a specific item
 * Matches mods based on the item's type field (e.g., "Rifle", "Shotgun", "Bow", etc.)
 * For items without a type field, falls back to category-based filtering
 * For warframes, also includes augment mods specific to that warframe
 */
export function getModsForItem(item: {
  type?: string
  category?: string
  name?: string
  trigger?: string
}): Mod[] {
  const itemType = item.type
  const itemName = item.name

  if (!itemType) {
    // No type info - fall back to category-based filtering
    const category = item.category?.toLowerCase()
    if (category === "primary") return getModsForCategory("primary")
    if (category === "secondary") return getModsForCategory("secondary")
    if (category === "melee") return getModsForCategory("melee")
    if (category === "warframes") return getModsForCategory("warframes")
    if (category === "necramechs") return getModsForCategory("necramechs")
    if (category === "companions") return getModsForCategory("companions")
    if (category === "archwing") return getModsForCategory("archwing")
    return []
  }

  const itemTypeLower = itemType.toLowerCase()
  const itemNameLower = itemName?.toLowerCase() ?? ""
  const allModsNormalized = getAllMods()

  return allModsNormalized.filter((mod) => {
    const compatName = mod.compatName?.toLowerCase() ?? ""
    const modType = mod.type?.toLowerCase() ?? ""

    // Primary weapons: Rifle, Shotgun, Sniper, Launcher, Bow
    if (PRIMARY_SUBTYPES.includes(itemTypeLower)) {
      return isPrimaryMod(compatName, modType, itemTypeLower)
    }

    // Secondary weapons: Pistol
    if (itemTypeLower === "pistol") {
      return isPistolMod(compatName, modType)
    }

    // Melee weapons
    if (itemTypeLower === "melee") {
      return isMeleeMod(compatName, modType)
    }

    // Arch-Gun
    if (itemTypeLower === "arch-gun") {
      return compatName === "archgun" || modType.includes("arch-gun")
    }

    // Arch-Melee
    if (itemTypeLower === "arch-melee") {
      return compatName === "archmelee" || modType.includes("arch-melee")
    }

    // Archwing
    if (itemTypeLower === "archwing") {
      return compatName === "archwing" || modType.includes("archwing")
    }

    // Exalted weapons — WFCD data uses type "Exalted Weapon" for all.
    // We infer the mod pool from the weapon's name and trigger field:
    //   - Name contains "bow" → primary/bow mods (e.g. Artemis Bow)
    //   - Has a trigger field → ranged/pistol mods (e.g. Regulators, Dex Pixia)
    //     (WFCD sets `trigger` on ranged weapons only; melee exalted have no trigger)
    //   - Otherwise → melee mods (e.g. Exalted Blade, Iron Staff)
    if (itemTypeLower === "exalted weapon") {
      if (itemNameLower.includes("bow")) {
        return isPrimaryMod(compatName, modType, "bow")
      }
      if (item.trigger) {
        return isPistolMod(compatName, modType)
      }
      return isMeleeMod(compatName, modType)
    }

    // Warframes
    if (itemTypeLower === "warframe") {
      // Include general warframe mods and aura mods
      if (
        modType.includes("warframe") &&
        (compatName === "warframe" || compatName === "aura")
      ) {
        return true
      }
      // Include warframe-specific augment mods if we have the warframe name
      // Also handle Prime variants (e.g., "Ash Prime" should match "Ash" augments)
      if (itemName && mod.isAugment && modType.includes("warframe")) {
        const baseItemName = itemNameLower.replace(" prime", "")
        if (compatName === itemNameLower || compatName === baseItemName) {
          return true
        }
      }
      return false
    }

    // Necramech
    if (itemTypeLower === "necramech") {
      return modType.includes("necramech")
    }

    // Companion
    if (["companion", "sentinel", "beast", "pets"].includes(itemTypeLower)) {
      return (
        modType.includes("companion") ||
        modType.includes("sentinel") ||
        modType.includes("beast")
      )
    }

    return false
  })
}

function normalizeAugmentAbilityName(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim()
}

function getAugmentedAbilityName(mod: Mod): string | null {
  const stats = [
    ...(mod.stats ?? []),
    ...(mod.levelStats?.flatMap((level) => level.stats) ?? []),
  ]

  for (const stat of stats) {
    const match = stat.match(/^(.+?)\s+Augment:/i)
    if (match?.[1]) {
      return normalizeAugmentAbilityName(match[1])
    }
  }

  return null
}

/**
 * Get source-warframe augment mods that become legal when a Helminth ability is
 * subsumed onto another Warframe.
 */
export function getAugmentModsForHelminthAbility(
  ability: HelminthAbility,
): Mod[] {
  if (ability.source === "Helminth") return []

  const sourceName = ability.source.toLowerCase()
  const abilityName = normalizeAugmentAbilityName(ability.name)

  return getAllMods().filter((mod) => {
    if (!mod.isAugment) return false
    if (!mod.type?.toLowerCase().includes("warframe")) return false
    if (mod.compatName?.toLowerCase() !== sourceName) return false

    return getAugmentedAbilityName(mod) === abilityName
  })
}

/**
 * Get a specific mod by unique name
 */
export function getModByUniqueName(uniqueName: string): Mod | undefined {
  if (!modByUniqueNameMap) {
    modByUniqueNameMap = new Map(
      getAllMods().map((mod) => [mod.uniqueName, mod]),
    )
  }
  return modByUniqueNameMap.get(uniqueName)
}

/**
 * Get a specific mod by name
 */
export function getModByName(name: string): Mod | undefined {
  const lowerName = name.toLowerCase()
  return getAllMods().find((mod) => mod.name.toLowerCase() === lowerName)
}

// =============================================================================
// MOD FAMILY DETECTION
// =============================================================================

// Known mod families where only one variant can be equipped
const MOD_FAMILIES: Record<string, string[]> = {
  // Damage mods
  Serration: ["Serration", "Amalgam Serration"],
  "Point Blank": ["Point Blank", "Primed Point Blank"],
  "Hornet Strike": ["Hornet Strike", "Primed Hornet Strike"],
  "Pressure Point": [
    "Pressure Point",
    "Primed Pressure Point",
    "Sacrificial Pressure",
  ],

  // Multishot
  "Split Chamber": ["Split Chamber", "Vigilante Armaments"],
  "Hell's Chamber": ["Hell's Chamber", "Primed Ravage"],
  "Barrel Diffusion": ["Barrel Diffusion", "Primed Pistol Gambit"],

  // Crit mods
  "Point Strike": ["Point Strike", "Critical Delay"],
  "Vital Sense": ["Vital Sense", "Primed Vital Sense"],
  "Pistol Gambit": ["Pistol Gambit", "Primed Pistol Gambit"],
  "Target Cracker": ["Target Cracker", "Primed Target Cracker"],
  "True Steel": ["True Steel", "Sacrificial Steel"],
  "Organ Shatter": ["Organ Shatter", "Primed Organ Shatter"],

  // Elemental mods
  Intensify: ["Intensify", "Umbral Intensify"],
  Vitality: ["Vitality", "Primed Vitality", "Umbral Vitality"],
  "Steel Fiber": ["Steel Fiber", "Umbral Fiber"],
  Redirection: ["Redirection", "Primed Redirection"],
  Continuity: ["Continuity", "Primed Continuity"],
  Flow: ["Flow", "Primed Flow"],
  Streamline: ["Streamline", "Fleeting Expertise"],

  // Reach mods
  Reach: ["Reach", "Primed Reach"],

  // Fury mods
  Fury: ["Fury", "Primed Fury"],

  // Fever Strike family
  "Fever Strike": ["Fever Strike", "Primed Fever Strike"],
}

// Pre-built reverse map: mod name → family name (O(1) lookups)
const MOD_NAME_TO_FAMILY = new Map<string, string>()
for (const [familyName, members] of Object.entries(MOD_FAMILIES)) {
  for (const member of members) {
    MOD_NAME_TO_FAMILY.set(member, familyName)
  }
}

/**
 * Get the family name for a mod (for duplicate prevention)
 * Mods in the same family cannot be equipped together
 */
export function getModFamily(mod: Mod): string | null {
  const modName = mod.name

  // O(1) lookup in pre-built reverse map
  const family = MOD_NAME_TO_FAMILY.get(modName)
  if (family) return family

  // Check for Primed/Umbral/Sacrificial variants
  if (modName.startsWith("Primed ")) {
    return modName.replace("Primed ", "")
  }
  if (modName.startsWith("Umbral ")) {
    return modName.replace("Umbral ", "")
  }
  if (modName.startsWith("Sacrificial ")) {
    return modName.replace("Sacrificial ", "")
  }
  if (modName.startsWith("Amalgam ")) {
    return modName.replace("Amalgam ", "")
  }

  // No family - mod can be equipped freely
  return null
}

/**
 * Check if a mod can be added to a build (not a duplicate family member)
 */
export function canAddModToBuild(mod: Mod, existingMods: Mod[]): boolean {
  const modFamily = getModFamily(mod)

  // No family restriction
  if (!modFamily) {
    // Still check for exact duplicates
    return !existingMods.some((m) => m.uniqueName === mod.uniqueName)
  }

  // Check if any existing mod is in the same family
  for (const existing of existingMods) {
    const existingFamily = getModFamily(existing)
    if (existingFamily === modFamily) {
      return false
    }
  }

  return true
}

// =============================================================================
// ARCANE QUERIES
// =============================================================================

/**
 * Get all arcanes from the data
 */
export function getAllArcanes(): Arcane[] {
  if (cachedAllArcanes) return cachedAllArcanes

  cachedAllArcanes = allArcanes.filter((arcane) => {
    if (!arcane.name) return false
    if (arcane.name === "Arcane") return false
    // Filter out duplicate/legacy arcanes marked as excluded from codex
    // (e.g., the incorrect Arcane Fury that shows pistol damage instead of melee damage)
    if ((arcane as { excludeFromCodex?: boolean }).excludeFromCodex)
      return false
    return true
  })

  return cachedAllArcanes
}

/**
 * Get arcanes for a specific slot type (Warframe, Operator, etc.)
 */
export function getArcanesForSlot(
  slotType:
    | "warframe"
    | "operator"
    | "primary"
    | "secondary"
    | "melee"
    | "weapon",
): Arcane[] {
  const cached = cachedArcanesBySlot.get(slotType)
  if (cached) return cached

  const allArcanesData = getAllArcanes()

  const filtered = allArcanesData.filter((arcane) => {
    const type = arcane.type?.toLowerCase() ?? ""

    switch (slotType) {
      case "warframe":
        return type === "arcane" || type === "warframe arcane"
      case "operator":
        return type.includes("magus") || type.includes("operator")
      case "primary":
        // Primary arcanes generally have "Primary" in type or name if type is generic
        // Main primary arcanes are "Primary Merciless", "Primary Deadhead", etc.
        // They often have type "Primary Arcane" or similar.
        return (
          type.includes("primary") ||
          type.includes("residua") ||
          type.includes("fractal")
        ) // residues/fractals are kitgun arcanes but often equipable
      case "secondary":
        // Secondary arcanes are "Secondary Merciless", etc.
        // Kitgun secondary arcanes are Pax
        return type.includes("secondary") || type.includes("pax")
      case "melee":
        // Melee arcanes include Zaw arcanes (Exodia) and new melee arcanes (Melee Duplicate, etc.)
        return type.includes("melee") || type.includes("exodia")
      case "weapon":
        // All weapon arcanes (primary, secondary, melee)
        return (
          type.includes("primary") ||
          type.includes("residua") ||
          type.includes("fractal") ||
          type.includes("secondary") ||
          type.includes("pax") ||
          type.includes("melee") ||
          type.includes("exodia")
        )
      default:
        return false
    }
  })

  cachedArcanesBySlot.set(slotType, filtered)
  return filtered
}

/**
 * Get a specific arcane by unique name
 */
export function getArcaneByUniqueName(uniqueName: string): Arcane | undefined {
  if (!arcaneByUniqueNameMap) {
    arcaneByUniqueNameMap = new Map(
      getAllArcanes().map((a) => [a.uniqueName, a]),
    )
  }
  return arcaneByUniqueNameMap.get(uniqueName)
}

/**
 * Get a specific arcane by name
 */
export function getArcaneByName(name: string): Arcane | undefined {
  const lowerName = name.toLowerCase()
  return getAllArcanes().find(
    (arcane) => arcane.name.toLowerCase() === lowerName,
  )
}
