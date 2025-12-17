/**
 * Unified Data Access Layer for Warframe Data
 *
 * This module provides a single API that switches between:
 * - Static JSON files (default, USE_DATABASE=false)
 * - Database queries (USE_DATABASE=true)
 *
 * Server-only - do not import in client components
 */

import type {
  BrowseCategory,
  BrowseItem,
  BrowseableItem,
  Mod,
  Arcane,
  ModCompatibility,
} from "./types";

// Static JSON imports (existing implementation)
import * as jsonItems from "./items";
import * as jsonMods from "./mods";

// Database imports (new implementation)
import {
  getItemsByCategoryFromDb,
  getItemBySlugFromDb,
  getCategoryCountsFromDb,
} from "@/lib/db/items";
import {
  getAllModsFromDb,
  getModsForCategoryFromDb,
  getModByUniqueNameFromDb,
  getAllArcanesFromDb,
  getArcanesForSlotFromDb,
} from "@/lib/db/mods";

/**
 * Check if database mode is enabled
 */
function isDatabaseEnabled(): boolean {
  return process.env.USE_DATABASE === "true";
}

// =============================================================================
// ITEMS API
// =============================================================================

/**
 * Get all items for a browse category
 */
export async function getItemsByCategory(
  category: BrowseCategory
): Promise<BrowseItem[]> {
  if (isDatabaseEnabled()) {
    return getItemsByCategoryFromDb(category);
  }
  return jsonItems.getItemsByCategory(category);
}

/**
 * Get a single item by slug and category
 */
export async function getItemBySlug(
  category: BrowseCategory,
  slug: string
): Promise<BrowseableItem | null> {
  if (isDatabaseEnabled()) {
    return getItemBySlugFromDb(category, slug);
  }
  return jsonItems.getItemBySlug(category, slug);
}

/**
 * Get full item data by unique name and category
 */
export async function getFullItem(
  category: BrowseCategory,
  uniqueName: string
): Promise<BrowseableItem | null> {
  if (isDatabaseEnabled()) {
    return getItemBySlugFromDb(category, uniqueName); // Will need adjustment
  }
  return jsonItems.getFullItem(category, uniqueName);
}

/**
 * Get category counts
 */
export async function getCategoryCounts(): Promise<
  Record<BrowseCategory, number>
> {
  if (isDatabaseEnabled()) {
    return getCategoryCountsFromDb();
  }
  return jsonItems.getCategoryCounts();
}

/**
 * Filter items (works the same for both sources)
 */
export function filterItems(
  items: BrowseItem[],
  filters: Parameters<typeof jsonItems.filterItems>[1]
): BrowseItem[] {
  return jsonItems.filterItems(items, filters);
}

/**
 * Sort items (works the same for both sources)
 */
export function sortItems(
  items: BrowseItem[],
  sortOption?: Parameters<typeof jsonItems.sortItems>[1]
): BrowseItem[] {
  return jsonItems.sortItems(items, sortOption);
}

/**
 * Get items for static generation
 */
export function getStaticItems(
  limit?: number
): Array<{ category: BrowseCategory; slug: string }> {
  return jsonItems.getStaticItems(limit);
}

// =============================================================================
// MODS API
// =============================================================================

/**
 * Get all mods
 */
export async function getAllMods(): Promise<Mod[]> {
  if (isDatabaseEnabled()) {
    return getAllModsFromDb();
  }
  return jsonMods.getAllMods();
}

/**
 * Get mods for a browse category
 */
export async function getModsForCategory(category: string): Promise<Mod[]> {
  if (isDatabaseEnabled()) {
    return getModsForCategoryFromDb(category);
  }
  return jsonMods.getModsForCategory(category);
}

/**
 * Get mods by compatibility
 */
export async function getModsByCompatibility(
  compatibility: ModCompatibility
): Promise<Mod[]> {
  if (isDatabaseEnabled()) {
    const { getModsByCompatibilityFromDb } = await import("@/lib/db/mods");
    return getModsByCompatibilityFromDb(compatibility);
  }
  return jsonMods.getModsByCompatibility(compatibility);
}

/**
 * Get a specific mod by unique name
 */
export async function getModByUniqueName(
  uniqueName: string
): Promise<Mod | undefined> {
  if (isDatabaseEnabled()) {
    const mod = await getModByUniqueNameFromDb(uniqueName);
    return mod ?? undefined;
  }
  return jsonMods.getModByUniqueName(uniqueName);
}

/**
 * Get a specific mod by name
 */
export async function getModByName(name: string): Promise<Mod | undefined> {
  if (isDatabaseEnabled()) {
    const mods = await getAllModsFromDb();
    return mods.find((m) => m.name.toLowerCase() === name.toLowerCase());
  }
  return jsonMods.getModByName(name);
}

/**
 * Get mod family (for duplicate prevention)
 */
export function getModFamily(mod: Mod): string | null {
  return jsonMods.getModFamily(mod);
}

/**
 * Check if a mod can be added to a build
 */
export function canAddModToBuild(mod: Mod, existingMods: Mod[]): boolean {
  return jsonMods.canAddModToBuild(mod, existingMods);
}

// =============================================================================
// ARCANES API
// =============================================================================

/**
 * Get all arcanes
 */
export async function getAllArcanes(): Promise<Arcane[]> {
  if (isDatabaseEnabled()) {
    return getAllArcanesFromDb();
  }
  return jsonMods.getAllArcanes();
}

/**
 * Get arcanes for a specific slot type
 */
export async function getArcanesForSlot(
  slotType: "warframe" | "operator" | "weapon"
): Promise<Arcane[]> {
  if (isDatabaseEnabled()) {
    return getArcanesForSlotFromDb(slotType);
  }
  return jsonMods.getArcanesForSlot(slotType);
}

/**
 * Get a specific arcane by unique name
 */
export async function getArcaneByUniqueName(
  uniqueName: string
): Promise<Arcane | undefined> {
  if (isDatabaseEnabled()) {
    const arcanes = await getAllArcanesFromDb();
    return arcanes.find((a) => a.uniqueName === uniqueName);
  }
  return jsonMods.getArcaneByUniqueName(uniqueName);
}

/**
 * Get a specific arcane by name
 */
export async function getArcaneByName(name: string): Promise<Arcane | undefined> {
  if (isDatabaseEnabled()) {
    const arcanes = await getAllArcanesFromDb();
    return arcanes.find((a) => a.name.toLowerCase() === name.toLowerCase());
  }
  return jsonMods.getArcaneByName(name);
}

// =============================================================================
// POLARITY UTILITIES (same for both sources)
// =============================================================================

export { normalizePolarity } from "./mods";
