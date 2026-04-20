/**
 * Mod compatibility helpers. Pure functions — caller supplies the raw WFCD
 * mods array. The build script normalizes once and filters per item.
 */

import type { Mod, ModCompatibility, Polarity } from "./types"

export function normalizePolarity(polarity?: string): Polarity {
  if (!polarity || typeof polarity !== "string") return "universal"
  const lower = polarity.toLowerCase()

  const map: Record<string, Polarity> = {
    madurai: "madurai",
    vazarin: "vazarin",
    naramon: "naramon",
    zenurik: "zenurik",
    unairu: "unairu",
    penjaga: "penjaga",
    umbra: "umbra",
    any: "any",
    universal: "universal",
    d: "vazarin",
    r: "madurai",
    dash: "naramon",
    v: "madurai",
  }

  return map[lower] ?? "universal"
}

/** Strip variants/tutorial/nemesis duplicates and normalize polarity + special rarities. */
export function normalizeMods(rawMods: Mod[]): Mod[] {
  const modSetIndex = new Map<string, Mod>()
  for (const mod of rawMods) {
    if (mod.uniqueName && mod.stats) {
      modSetIndex.set(mod.uniqueName, mod)
    }
  }

  return rawMods
    .filter((mod) => {
      if (!mod.name) return false
      if (mod.name.includes("Riven Mod")) return false
      if (!mod.compatName && !mod.type) return false
      if (mod.description?.includes("Conclave")) return false

      const uniqueName = mod.uniqueName ?? ""
      if (uniqueName.includes("/Beginner/")) return false
      if (uniqueName.endsWith("Intermediate")) return false
      if (uniqueName.endsWith("Expert") && !mod.name.includes("Primed"))
        return false
      if (uniqueName.includes("/Nemesis/")) return false
      if (uniqueName.endsWith("SubMod")) return false

      return true
    })
    .map((mod) => {
      let modSetStats: string[] | undefined
      if (mod.modSet) {
        const setMod = modSetIndex.get(mod.modSet)
        if (setMod?.stats) modSetStats = setMod.stats
      }

      let rarity = mod.rarity
      if (mod.name.startsWith("Amalgam ")) rarity = "Amalgam"
      else if (mod.name.startsWith("Galvanized ")) rarity = "Galvanized"

      return {
        ...mod,
        polarity: normalizePolarity(mod.polarity as unknown as string),
        modSetStats,
        rarity,
      }
    })
}

// --- compatibility matchers ---

function isPrimaryMod(compatName: string, modType: string, subtype: string) {
  if (compatName === subtype) return true
  if (modType.includes(subtype)) return true
  if (subtype !== "shotgun" && compatName === "rifle") return true
  if (subtype !== "shotgun" && compatName === "rifle (no aoe)") return true
  if (subtype !== "shotgun" && compatName === "assault rifle") return true
  if (compatName === "primary") return true
  if (
    modType.includes("primary") &&
    !compatName &&
    !modType.includes("rifle") &&
    !modType.includes("shotgun") &&
    !modType.includes("sniper") &&
    !modType.includes("launcher") &&
    !modType.includes("bow")
  )
    return true
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

function modMatchesCompat(mod: Mod, compatibility: ModCompatibility): boolean {
  const compatName = mod.compatName?.toLowerCase() ?? ""
  const modType = mod.type?.toLowerCase() ?? ""

  switch (compatibility) {
    case "Warframe":
      return (
        modType.includes("warframe") &&
        (compatName === "warframe" || compatName === "aura")
      )
    case "Aura":
      return modType.includes("aura") || compatName === "aura"
    case "Exilus":
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
}

const CATEGORY_TO_COMPAT: Record<string, ModCompatibility[]> = {
  warframes: ["Warframe"],
  primary: ["Rifle", "Shotgun"],
  secondary: ["Pistol"],
  melee: ["Melee"],
  "exalted-weapons": ["Rifle", "Pistol", "Melee"],
  necramechs: ["Necramech"],
  companions: ["Companion"],
  archwing: ["Archwing", "Archgun", "Archmelee"],
}

/**
 * Return the mods compatible with the given item. `mods` must already be
 * normalized via `normalizeMods`.
 */
export function getModsForItem(
  item: { type?: string; category?: string; name?: string; trigger?: string },
  mods: Mod[],
): Mod[] {
  const itemType = item.type
  const itemName = item.name

  if (!itemType) {
    const category = item.category?.toLowerCase()
    const compats = category ? CATEGORY_TO_COMPAT[category] : undefined
    if (!compats) return []
    return mods.filter((m) => compats.some((c) => modMatchesCompat(m, c)))
  }

  const itemTypeLower = itemType.toLowerCase()
  const itemNameLower = itemName?.toLowerCase() ?? ""

  if (itemTypeLower === "zaw component") {
    return mods.filter((m) => modMatchesCompat(m, "Melee"))
  }

  return mods.filter((mod) => {
    const compatName = mod.compatName?.toLowerCase() ?? ""
    const modType = mod.type?.toLowerCase() ?? ""

    if (PRIMARY_SUBTYPES.includes(itemTypeLower)) {
      if (
        modType.includes("primary") &&
        compatName &&
        itemNameLower.includes(compatName)
      )
        return true
      return isPrimaryMod(compatName, modType, itemTypeLower)
    }

    if (itemTypeLower === "pistol" || itemTypeLower === "throwing") {
      if (
        modType.includes("secondary") &&
        compatName &&
        itemNameLower.includes(compatName)
      )
        return true
      return isPistolMod(compatName, modType)
    }

    if (itemTypeLower === "melee") {
      if (
        modType.includes("melee") &&
        compatName &&
        itemNameLower.includes(compatName)
      )
        return true
      return isMeleeMod(compatName, modType)
    }

    if (itemTypeLower === "arch-gun")
      return compatName === "archgun" || modType.includes("arch-gun")
    if (itemTypeLower === "arch-melee")
      return compatName === "archmelee" || modType.includes("arch-melee")
    if (itemTypeLower === "archwing")
      return compatName === "archwing" || modType.includes("archwing")

    if (itemTypeLower === "exalted weapon") {
      if (itemNameLower.includes("bow"))
        return isPrimaryMod(compatName, modType, "bow")
      if (item.trigger) return isPistolMod(compatName, modType)
      return isMeleeMod(compatName, modType)
    }

    if (itemTypeLower === "warframe") {
      if (
        modType.includes("warframe") &&
        (compatName === "warframe" || compatName === "aura")
      )
        return true
      if (itemName && mod.isAugment && modType.includes("warframe")) {
        const baseItemName = itemNameLower.replace(" prime", "")
        if (compatName === itemNameLower || compatName === baseItemName)
          return true
      }
      return false
    }

    if (itemTypeLower === "necramech") return modType.includes("necramech")

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
