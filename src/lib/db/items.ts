import "server-only";

/**
 * Database queries for Items
 */

import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { BrowseCategory, BrowseItem, BrowseableItem } from "@/lib/warframe/types";
import { ItemDataSchema, safeParseOrCast } from "@/lib/warframe/schemas";
import { slugify, unslugify } from "@/lib/warframe/slugs";

/**
 * Get all items for a specific browse category from the database
 */
export const getItemsByCategoryFromDb = unstable_cache(
  async (category: BrowseCategory): Promise<BrowseItem[]> => {
    const items = await prisma.item.findMany({
      where: { browseCategory: category },
      orderBy: { name: "asc" },
    });

    return items.map((item) => ({
      uniqueName: item.uniqueName,
      name: item.name,
      slug: slugify(item.name),
      category,
      imageName: item.imageName ?? undefined,
      masteryReq: item.masteryReq ?? undefined,
      isPrime: item.isPrime,
      vaulted: item.vaulted,
      type: (item.data as { type?: string })?.type,
      releaseDate: item.releaseDate?.toISOString().split("T")[0],
    }));
  },
  ["items-by-category"],
  { revalidate: 3600, tags: ["items"] }
);

/**
 * Get a single item by unique name from the database
 */
export const getItemByUniqueNameFromDb = unstable_cache(
  async (uniqueName: string): Promise<BrowseableItem | null> => {
    const item = await prisma.item.findUnique({
      where: { uniqueName },
    });

    if (!item) return null;

    // Return the full WFCD data stored in the data JSON field
    return safeParseOrCast(ItemDataSchema, item.data, `item ${uniqueName}`) as BrowseableItem;
  },
  ["item-by-unique-name"],
  { revalidate: 3600, tags: ["items"] }
);

/**
 * Get item by slug and category from the database
 */
export async function getItemBySlugFromDb(
  category: BrowseCategory,
  slug: string
): Promise<BrowseableItem | null> {
  // Convert slug back to a search term and query with case-insensitive contains
  const searchTerm = unslugify(slug);
  const candidates = await prisma.item.findMany({
    where: {
      browseCategory: category,
      name: { contains: searchTerm, mode: "insensitive" },
    },
    take: 20,
  });

  for (const item of candidates) {
    if (slugify(item.name) === slug) {
      return safeParseOrCast(ItemDataSchema, item.data, `item ${item.uniqueName}`) as BrowseableItem;
    }
  }

  return null;
}

/**
 * Get category counts from the database (single grouped query)
 */
export const getCategoryCountsFromDb = unstable_cache(
  async (): Promise<Record<BrowseCategory, number>> => {
    const counts: Record<BrowseCategory, number> = {
      warframes: 0,
      primary: 0,
      secondary: 0,
      melee: 0,
      necramechs: 0,
      companions: 0,
      "companion-weapons": 0,
      "exalted-weapons": 0,
      archwing: 0,
    };

    const grouped = await prisma.item.groupBy({
      by: ["browseCategory"],
      _count: true,
    });

    for (const row of grouped) {
      const category = row.browseCategory as BrowseCategory;
      if (category in counts) {
        counts[category] = row._count;
      }
    }

    return counts;
  },
  ["category-counts"],
  { revalidate: 3600, tags: ["items"] }
);

/**
 * Search items by name
 */
export async function searchItemsFromDb(
  query: string,
  category?: BrowseCategory,
  limit = 20
): Promise<BrowseItem[]> {
  const items = await prisma.item.findMany({
    where: {
      name: { contains: query, mode: "insensitive" },
      ...(category && { browseCategory: category }),
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return items.map((item) => ({
    uniqueName: item.uniqueName,
    name: item.name,
    slug: slugify(item.name),
    category: item.browseCategory as BrowseCategory,
    imageName: item.imageName ?? undefined,
    masteryReq: item.masteryReq ?? undefined,
    isPrime: item.isPrime,
    vaulted: item.vaulted,
    type: (item.data as { type?: string })?.type,
    releaseDate: item.releaseDate?.toISOString().split("T")[0],
  }));
}
