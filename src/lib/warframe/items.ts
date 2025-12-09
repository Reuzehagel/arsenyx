// Warframe items service - directly importing JSON data
// Note: We import JSON directly instead of using the Items class
// because @wfcd/items uses fs.readdirSync which doesn't work with Next.js bundling
// Data files are copied from @wfcd/items/data/json/ to src/data/warframe/

import WarframesData from "@/data/warframe/Warframes.json";
import PrimaryData from "@/data/warframe/Primary.json";
import SecondaryData from "@/data/warframe/Secondary.json";
import MeleeData from "@/data/warframe/Melee.json";
import SentinelsData from "@/data/warframe/Sentinels.json";
import PetsData from "@/data/warframe/Pets.json";

import type {
  BrowseCategory,
  BrowseItem,
  BrowseFilters,
  BrowseableItem,
} from "./types";
import { BROWSE_CATEGORIES } from "./categories";
import { slugify } from "./slugs";

// Combined items array from all categories (loaded once at module init)
const allItems: BrowseableItem[] = [
  ...(WarframesData as BrowseableItem[]),
  ...(PrimaryData as BrowseableItem[]),
  ...(SecondaryData as BrowseableItem[]),
  ...(MeleeData as BrowseableItem[]),
  ...(SentinelsData as BrowseableItem[]),
  ...(PetsData as BrowseableItem[]),
];

// Precomputed caches to avoid repeated expensive work per request
const itemsByCategory = new Map<BrowseCategory, BrowseItem[]>();
const slugLookup = new Map<string, BrowseableItem>(); // key: `${category}|${slug}`
const uniqueNameLookup = new Map<string, BrowseableItem>();
const categoryCounts: Record<BrowseCategory, number> = {
  warframes: 0,
  primary: 0,
  secondary: 0,
  melee: 0,
  necramechs: 0,
  companions: 0,
};

/**
 * Check if an item is a Necramech
 */
function isNecramech(item: BrowseableItem): boolean {
  return (
    item.category === "Warframes" &&
    (item.name.includes("Necramech") ||
      item.name === "Bonewidow" ||
      item.name === "Voidrig")
  );
}

/**
 * Map a raw WFCD item to our BrowseItem format
 */
function toBrowseItem(
  item: BrowseableItem,
  category: BrowseCategory
): BrowseItem {
  return {
    uniqueName: item.uniqueName,
    name: item.name,
    slug: slugify(item.name),
    category,
    imageName: item.imageName,
    masteryReq: item.masteryReq,
    isPrime: item.isPrime ?? item.name.includes("Prime"),
    vaulted: item.vaulted,
    type: (item as { type?: string }).type,
  };
}

// Determine all browse categories an item belongs to
function categorizeItem(item: BrowseableItem): BrowseCategory[] {
  if (!item.name || item.name.includes(" Blueprint")) return [];

  const itemCategory = item.category as string;
  const categories: BrowseCategory[] = [];

  if (itemCategory === "Warframes") {
    if (isNecramech(item)) {
      categories.push("necramechs");
    } else {
      categories.push("warframes");
    }
  }

  if (itemCategory === "Primary") categories.push("primary");
  if (itemCategory === "Secondary") categories.push("secondary");
  if (itemCategory === "Melee") categories.push("melee");
  if (itemCategory === "Sentinels" || itemCategory === "Pets") {
    categories.push("companions");
  }

  return categories;
}

// Build caches once
for (const config of BROWSE_CATEGORIES) {
  itemsByCategory.set(config.id, []);
}

for (const item of allItems) {
  uniqueNameLookup.set(item.uniqueName, item);

  const categories = categorizeItem(item);
  for (const category of categories) {
    const list = itemsByCategory.get(category);
    if (!list) continue;

    const browseItem = toBrowseItem(item, category);
    list.push(browseItem);
    slugLookup.set(`${category}|${browseItem.slug}`, item);
  }
}

// Sort lists and count once
for (const [category, list] of itemsByCategory.entries()) {
  list.sort((a, b) => a.name.localeCompare(b.name));
  categoryCounts[category] = list.length;
}

/**
 * Get all items for a specific browse category
 */
export function getItemsByCategory(category: BrowseCategory): BrowseItem[] {
  return itemsByCategory.get(category) ?? [];
}

/**
 * Filter items based on browse filters
 */
export function filterItems(
  items: BrowseItem[],
  filters: Partial<BrowseFilters>
): BrowseItem[] {
  let result = [...items];

  // Text search
  if (filters.query) {
    const query = filters.query.toLowerCase();
    result = result.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.type?.toLowerCase().includes(query)
    );
  }

  // Mastery requirement filter
  if (filters.masteryMax !== undefined) {
    result = result.filter(
      (item) => (item.masteryReq ?? 0) <= filters.masteryMax!
    );
  }

  // Prime only filter
  if (filters.primeOnly) {
    result = result.filter((item) => item.isPrime);
  }

  // Hide vaulted filter
  if (filters.hideVaulted) {
    result = result.filter((item) => !item.vaulted);
  }

  return result;
}

/**
 * Get a single item by slug and category
 */
export function getItemBySlug(
  category: BrowseCategory,
  slug: string
): BrowseableItem | null {
  const key = `${category}|${slug}`;
  return slugLookup.get(key) ?? null;
}

/**
 * Get items for static generation (top N items per category)
 */
export function getStaticItems(limit = 50): Array<{
  category: BrowseCategory;
  slug: string;
}> {
  const result: Array<{ category: BrowseCategory; slug: string }> = [];

  for (const config of BROWSE_CATEGORIES) {
    const items = getItemsByCategory(config.id);
    // Prioritize prime items and popular frames
    const sorted = items.sort((a, b) => {
      // Primes first
      if (a.isPrime && !b.isPrime) return -1;
      if (!a.isPrime && b.isPrime) return 1;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });

    for (const item of sorted.slice(0, limit)) {
      result.push({
        category: config.id,
        slug: item.slug,
      });
    }
  }

  return result;
}

/**
 * Get total count of items per category (for UI display)
 */
export function getCategoryCounts(): Record<BrowseCategory, number> {
  return categoryCounts;
}

/**
 * Get full item data by unique name and category
 * Returns the complete item object with all fields
 */
export function getFullItem(
  category: BrowseCategory,
  uniqueName: string
): BrowseableItem | null {
  // Validate the unique name exists at all
  const item = uniqueNameLookup.get(uniqueName);
  if (!item) return null;

  // Ensure the item belongs to the requested category
  const categories = categorizeItem(item);
  if (categories.includes(category)) {
    return item;
  }

  return null;
}
