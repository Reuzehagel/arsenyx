/**
 * Database queries for Items
 * Server-only - do not import in client components
 */

import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { BrowseCategory, BrowseItem, BrowseableItem } from "@/lib/warframe/types";
import { slugify } from "@/lib/warframe/slugs";

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
    return item.data as unknown as BrowseableItem;
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
  // Since we don't store slugs in DB, we need to find by name pattern
  // This is a limitation - for better performance, consider storing slugs in DB
  const items = await prisma.item.findMany({
    where: { browseCategory: category },
  });

  for (const item of items) {
    if (slugify(item.name) === slug) {
      return item.data as unknown as BrowseableItem;
    }
  }

  return null;
}

/**
 * Get category counts from the database
 */
export const getCategoryCountsFromDb = unstable_cache(
  async (): Promise<Record<BrowseCategory, number>> => {
    const categories: BrowseCategory[] = [
      "warframes",
      "primary",
      "secondary",
      "melee",
      "necramechs",
      "companions",
      "companion-weapons",
      "exalted-weapons",
      "archwing",
    ];

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

    for (const category of categories) {
      counts[category] = await prisma.item.count({
        where: { browseCategory: category },
      });
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
