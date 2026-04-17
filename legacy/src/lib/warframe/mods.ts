// Mods and Arcanes service - server-only, imports JSON directly
// Data files are copied from @wfcd/items/data/json/ to src/data/warframe/

import ArcanesData from "@/data/warframe/Arcanes.json"
import ModsData from "@/data/warframe/Mods.json"

import { getHelminthAbilities } from "./helminth"
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
let modByNameMap: Map<string, Mod> | null = null
let arcaneByUniqueNameMap: Map<string, Arcane> | null = null

// =============================================================================
// POLARITY UTILITIES
// =============================================================================

/**
 * Normalize polarity string from WFCD data to our Polarity type
 */
export function normalizePolarity(polarity?: string): Polarity {
  if (!polarity || typeof polarity !== "string") return "universal"
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

      // Filter out Conclave-only mods (stances "devised for Conclave")
      // Note: most /PvPMods/ path mods are regular PvE mods (Reflex Draw, Anticipation, etc.)
      const uniqueName = mod.uniqueName ?? ""
      if (mod.description?.includes("Conclave")) return false

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
  // In Warframe, "Rifle" mods work on all non-shotgun primaries
  // (rifles, launchers, bows, snipers). Accept rifle-compatible mods
  // for any non-shotgun subtype, and shotgun mods only for shotguns.
  if (subtype !== "shotgun" && compatName === "rifle") return true
  if (subtype !== "shotgun" && compatName === "rifle (no aoe)") return true
  // "Assault Rifle" mods (e.g. Tainted Mag) work on all non-shotgun primaries
  if (subtype !== "shotgun" && compatName === "assault rifle") return true
  // "PRIMARY" mods (e.g. Vigilante set) work on ALL primaries including shotguns
  if (compatName === "primary") return true
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

  // Zaw Components are melee weapons
  if (itemTypeLower === "zaw component") {
    return getModsByCompatibility("Melee")
  }

  return allModsNormalized.filter((mod) => {
    const compatName = mod.compatName?.toLowerCase() ?? ""
    const modType = mod.type?.toLowerCase() ?? ""

    // Primary weapons: Rifle, Shotgun, Sniper, Launcher, Bow
    if (PRIMARY_SUBTYPES.includes(itemTypeLower)) {
      // Weapon-specific mods (e.g. "Ogris" mods for Kuva Ogris)
      if (
        modType.includes("primary") &&
        compatName &&
        itemNameLower.includes(compatName)
      ) {
        return true
      }
      return isPrimaryMod(compatName, modType, itemTypeLower)
    }

    // Secondary weapons: Pistol
    if (itemTypeLower === "pistol") {
      if (
        modType.includes("secondary") &&
        compatName &&
        itemNameLower.includes(compatName)
      ) {
        return true
      }
      return isPistolMod(compatName, modType)
    }

    // Melee weapons
    if (itemTypeLower === "melee") {
      if (
        modType.includes("melee") &&
        compatName &&
        itemNameLower.includes(compatName)
      ) {
        return true
      }
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
 * Pre-compute augment mods for every subsumable Helminth ability.
 * Returns a plain object keyed by ability uniqueName → Mod[] so it can be
 * serialised as a React Server Component prop.
 */
export function getAllHelminthAugmentMods(): Record<string, Mod[]> {
  const result: Record<string, Mod[]> = {}
  for (const ability of getHelminthAbilities()) {
    const mods = getAugmentModsForHelminthAbility(ability)
    if (mods.length > 0) {
      result[ability.uniqueName] = mods
    }
  }
  return result
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
  if (!modByNameMap) {
    modByNameMap = new Map(
      getAllMods().map((mod) => [mod.name.toLowerCase(), mod]),
    )
  }
  return modByNameMap.get(name.toLowerCase())
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
