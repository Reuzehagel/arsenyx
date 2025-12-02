// Mods and Arcanes service - server-only, imports JSON directly
// Data files are copied from @wfcd/items/data/json/ to src/data/warframe/

import ModsData from "@/data/warframe/Mods.json";
import ArcanesData from "@/data/warframe/Arcanes.json";

import type { Mod, Arcane, Polarity, ModCompatibility } from "./types";

// Type assertion for imported data
const allMods = ModsData as unknown as Mod[];
const allArcanes = ArcanesData as unknown as Arcane[];

// =============================================================================
// POLARITY UTILITIES
// =============================================================================

/**
 * Normalize polarity string from WFCD data to our Polarity type
 */
export function normalizePolarity(polarity?: string): Polarity {
  if (!polarity) return "universal";
  const lower = polarity.toLowerCase();

  const polarityMap: Record<string, Polarity> = {
    madurai: "madurai",
    vazarin: "vazarin",
    naramon: "naramon",
    zenurik: "zenurik",
    unairu: "unairu",
    penjaga: "penjaga",
    umbra: "umbra",
    universal: "universal",
    // Alternative names
    d: "vazarin",
    r: "madurai",
    dash: "naramon",
    v: "madurai",
  };

  return polarityMap[lower] ?? "universal";
}

// =============================================================================
// MOD QUERIES
// =============================================================================

/**
 * Get all mods from the data
 */
export function getAllMods(): Mod[] {
  return allMods
    .filter((mod) => {
      // Filter out Riven mods and other special cases
      if (!mod.name) return false;
      if (mod.name.includes("Riven Mod")) return false;
      if (!mod.compatName && !mod.type) return false;

      // Filter out variant mods (duplicates with different stats)
      // - Beginner: Tutorial versions with lower ranks (ends with "Beginner")
      // - Expert: Special event versions with higher ranks (ends with "Expert")
      // - Nemesis: Duplicate entries from Nemesis system
      // - SubMod: Internal sub-components of other mods (ends with "SubMod")
      const uniqueName = mod.uniqueName ?? "";
      if (uniqueName.includes("/Beginner/")) return false;
      if (uniqueName.endsWith("Expert")) return false;
      if (uniqueName.includes("/Nemesis/")) return false;
      if (uniqueName.endsWith("SubMod")) return false;

      return true;
    })
    .map((mod) => ({
      ...mod,
      polarity: normalizePolarity(mod.polarity as unknown as string),
    }));
}

/**
 * Get mods by compatibility category (e.g., "Warframe", "Rifle", "Melee")
 */
export function getModsByCompatibility(compatibility: ModCompatibility): Mod[] {
  const allModsNormalized = getAllMods();

  return allModsNormalized.filter((mod) => {
    const compatName = mod.compatName?.toLowerCase() ?? "";
    const modType = mod.type?.toLowerCase() ?? "";

    switch (compatibility) {
      case "Warframe":
        // Include general warframe mods (compatName is "WARFRAME") and aura mods
        // Exclude warframe-specific augments (where compatName is a specific warframe name like "Trinity")
        return (
          modType.includes("warframe") &&
          (compatName === "warframe" || compatName === "aura")
        );
      case "Aura":
        return modType.includes("aura") || compatName === "aura";
      case "Exilus":
        return mod.isExilus === true;
      case "Rifle":
        return compatName === "rifle" || modType.includes("rifle");
      case "Shotgun":
        return compatName === "shotgun" || modType.includes("shotgun");
      case "Pistol":
        return compatName === "pistol" || modType.includes("secondary");
      case "Melee":
        return compatName === "melee" || modType.includes("melee");
      case "Companion":
        return (
          modType.includes("companion") ||
          modType.includes("sentinel") ||
          modType.includes("beast")
        );
      case "Necramech":
        return modType.includes("necramech");
      default:
        return false;
    }
  });
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
    necramechs: ["Necramech"],
    companions: ["Companion"],
  };

  const compatibilities = categoryMap[category];
  if (!compatibilities) return [];

  const result: Mod[] = [];
  for (const compat of compatibilities) {
    result.push(...getModsByCompatibility(compat));
  }
  return result;
}

/**
 * Get a specific mod by unique name
 */
export function getModByUniqueName(uniqueName: string): Mod | undefined {
  return getAllMods().find((mod) => mod.uniqueName === uniqueName);
}

/**
 * Get a specific mod by name
 */
export function getModByName(name: string): Mod | undefined {
  const lowerName = name.toLowerCase();
  return getAllMods().find((mod) => mod.name.toLowerCase() === lowerName);
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
};

/**
 * Get the family name for a mod (for duplicate prevention)
 * Mods in the same family cannot be equipped together
 */
export function getModFamily(mod: Mod): string | null {
  const modName = mod.name;

  // Check if this mod is in any known family
  for (const [familyName, members] of Object.entries(MOD_FAMILIES)) {
    if (members.includes(modName)) {
      return familyName;
    }
  }

  // Check for Primed/Umbral/Sacrificial variants
  if (modName.startsWith("Primed ")) {
    return modName.replace("Primed ", "");
  }
  if (modName.startsWith("Umbral ")) {
    return modName.replace("Umbral ", "");
  }
  if (modName.startsWith("Sacrificial ")) {
    return modName.replace("Sacrificial ", "");
  }
  if (modName.startsWith("Amalgam ")) {
    return modName.replace("Amalgam ", "");
  }

  // No family - mod can be equipped freely
  return null;
}

/**
 * Check if a mod can be added to a build (not a duplicate family member)
 */
export function canAddModToBuild(mod: Mod, existingMods: Mod[]): boolean {
  const modFamily = getModFamily(mod);

  // No family restriction
  if (!modFamily) {
    // Still check for exact duplicates
    return !existingMods.some((m) => m.uniqueName === mod.uniqueName);
  }

  // Check if any existing mod is in the same family
  for (const existing of existingMods) {
    const existingFamily = getModFamily(existing);
    if (existingFamily === modFamily) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// ARCANE QUERIES
// =============================================================================

/**
 * Get all arcanes from the data
 */
export function getAllArcanes(): Arcane[] {
  return allArcanes.filter((arcane) => {
    if (!arcane.name) return false;
    return true;
  });
}

/**
 * Get arcanes for a specific slot type (Warframe, Operator, etc.)
 */
export function getArcanesForSlot(
  slotType: "warframe" | "operator" | "weapon"
): Arcane[] {
  const allArcanesData = getAllArcanes();

  return allArcanesData.filter((arcane) => {
    const type = arcane.type?.toLowerCase() ?? "";

    switch (slotType) {
      case "warframe":
        return (
          type === "arcane" &&
          !type.includes("operator") &&
          !type.includes("magus")
        );
      case "operator":
        return type.includes("magus") || type.includes("operator");
      case "weapon":
        return (
          type.includes("exodia") ||
          type.includes("pax") ||
          type.includes("virtuos")
        );
      default:
        return false;
    }
  });
}

/**
 * Get a specific arcane by unique name
 */
export function getArcaneByUniqueName(uniqueName: string): Arcane | undefined {
  return getAllArcanes().find((arcane) => arcane.uniqueName === uniqueName);
}

/**
 * Get a specific arcane by name
 */
export function getArcaneByName(name: string): Arcane | undefined {
  const lowerName = name.toLowerCase();
  return getAllArcanes().find(
    (arcane) => arcane.name.toLowerCase() === lowerName
  );
}
