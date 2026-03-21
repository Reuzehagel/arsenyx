import "server-only";

/**
 * Database queries for Mods and Arcanes
 */

import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { Mod, Arcane, ModCompatibility, Polarity } from "@/lib/warframe/types";
import { ModDataSchema, ArcaneDataSchema, safeParseOrCast } from "@/lib/warframe/schemas";

/**
 * Get all mods from the database
 */
export const getAllModsFromDb = unstable_cache(
  async (): Promise<Mod[]> => {
    const mods = await prisma.mod.findMany({
      orderBy: { name: "asc" },
    });

    return mods.map((mod) => ({
      uniqueName: mod.uniqueName,
      name: mod.name,
      description: mod.description ?? undefined,
      imageName: mod.imageName ?? undefined,
      polarity: mod.polarity as Polarity,
      rarity: mod.rarity as Mod["rarity"],
      baseDrain: mod.baseDrain,
      fusionLimit: mod.fusionLimit,
      compatName: mod.compatName ?? undefined,
      type: mod.type,
      tradable: mod.tradable,
      isAugment: mod.isAugment,
      isPrime: mod.isPrime,
      isExilus: mod.isExilus,
      // Include additional data from the JSON field
      ...safeParseOrCast(ModDataSchema, mod.data, `mod ${mod.uniqueName} data`),
    }));
  },
  ["all-mods"],
  { revalidate: 3600, tags: ["mods"] }
);

/**
 * Get mods by compatibility category from the database
 */
export const getModsByCompatibilityFromDb = unstable_cache(
  async (compatibility: ModCompatibility): Promise<Mod[]> => {
    const allMods = await getAllModsFromDb();

    return allMods.filter((mod) => {
      const compatName = mod.compatName?.toLowerCase() ?? "";
      const modType = mod.type?.toLowerCase() ?? "";

      switch (compatibility) {
        case "Warframe":
          return (
            modType.includes("warframe") &&
            (compatName === "warframe" || compatName === "aura")
          );
        case "Aura":
          return modType.includes("aura") || compatName === "aura";
        case "Exilus":
          // Both isExilus and isUtility indicate exilus-compatible mods in WFCD data
          // isUtility is spread from mod.data JSON field
          return mod.isExilus === true || mod.isUtility === true;
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
  },
  ["mods-by-compatibility"],
  { revalidate: 3600, tags: ["mods"] }
);

/**
 * Get mods for a browse category from the database
 */
export async function getModsForCategoryFromDb(category: string): Promise<Mod[]> {
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

  const results = await Promise.all(
    compatibilities.map((compat) => getModsByCompatibilityFromDb(compat))
  );
  return results.flat();
}

/**
 * Get a specific mod by unique name from the database
 */
export async function getModByUniqueNameFromDb(uniqueName: string): Promise<Mod | null> {
  const mod = await prisma.mod.findUnique({
    where: { uniqueName },
  });

  if (!mod) return null;

  return {
    uniqueName: mod.uniqueName,
    name: mod.name,
    description: mod.description ?? undefined,
    imageName: mod.imageName ?? undefined,
    polarity: mod.polarity as Polarity,
    rarity: mod.rarity as Mod["rarity"],
    baseDrain: mod.baseDrain,
    fusionLimit: mod.fusionLimit,
    compatName: mod.compatName ?? undefined,
    type: mod.type,
    tradable: mod.tradable,
    isAugment: mod.isAugment,
    isPrime: mod.isPrime,
    isExilus: mod.isExilus,
    ...safeParseOrCast(ModDataSchema, mod.data, `mod ${mod.uniqueName} data`),
  };
}

/**
 * Get all arcanes from the database
 */
export const getAllArcanesFromDb = unstable_cache(
  async (): Promise<Arcane[]> => {
    const arcanes = await prisma.arcane.findMany({
      orderBy: { name: "asc" },
    });

    return arcanes.map((arcane) => ({
      uniqueName: arcane.uniqueName,
      name: arcane.name,
      description: arcane.description ?? undefined,
      imageName: arcane.imageName ?? undefined,
      rarity: arcane.rarity as Arcane["rarity"],
      type: arcane.type,
      tradable: arcane.tradable,
      ...safeParseOrCast(ArcaneDataSchema, arcane.data, `arcane ${arcane.uniqueName} data`),
    }));
  },
  ["all-arcanes"],
  { revalidate: 3600, tags: ["arcanes"] }
);

/**
 * Get arcanes for a specific slot type from the database
 */
export async function getArcanesForSlotFromDb(
  slotType: "warframe" | "operator" | "weapon"
): Promise<Arcane[]> {
  const allArcanes = await getAllArcanesFromDb();

  return allArcanes.filter((arcane) => {
    const type = arcane.type?.toLowerCase() ?? "";

    switch (slotType) {
      case "warframe":
        return type === "warframe" && !type.includes("operator");
      case "operator":
        return type === "operator";
      case "weapon":
        return type === "weapon";
      default:
        return false;
    }
  });
}

/**
 * Search mods by name from the database
 */
export async function searchModsFromDb(
  query: string,
  compatibility?: ModCompatibility,
  limit = 20
): Promise<Mod[]> {
  const mods = await prisma.mod.findMany({
    where: {
      name: { contains: query, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    take: limit * 2, // Get more to filter
  });

  let results = mods.map((mod) => ({
    uniqueName: mod.uniqueName,
    name: mod.name,
    description: mod.description ?? undefined,
    imageName: mod.imageName ?? undefined,
    polarity: mod.polarity as Polarity,
    rarity: mod.rarity as Mod["rarity"],
    baseDrain: mod.baseDrain,
    fusionLimit: mod.fusionLimit,
    compatName: mod.compatName ?? undefined,
    type: mod.type,
    tradable: mod.tradable,
    isAugment: mod.isAugment,
    isPrime: mod.isPrime,
    isExilus: mod.isExilus,
    ...(mod.data as object),
  }));

  // Filter by compatibility if specified
  if (compatibility) {
    results = results.filter((mod) => {
      const compatName = mod.compatName?.toLowerCase() ?? "";
      const modType = mod.type?.toLowerCase() ?? "";

      switch (compatibility) {
        case "Warframe":
          return modType.includes("warframe");
        case "Rifle":
          return compatName === "rifle" || modType.includes("rifle");
        case "Shotgun":
          return compatName === "shotgun" || modType.includes("shotgun");
        case "Pistol":
          return compatName === "pistol" || modType.includes("secondary");
        case "Melee":
          return compatName === "melee" || modType.includes("melee");
        default:
          return true;
      }
    });
  }

  return results.slice(0, limit);
}
