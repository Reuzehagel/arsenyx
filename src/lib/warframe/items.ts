// Warframe items service - directly importing JSON data
// Note: We import JSON directly instead of using the Items class
// because @wfcd/items uses fs.readdirSync which doesn't work with Next.js bundling
// Data files are copied from @wfcd/items/data/json/ to src/data/warframe/

import ArchGunData from "@/data/warframe/Arch-Gun.json"
import ArchMeleeData from "@/data/warframe/Arch-Melee.json"
import ArchwingData from "@/data/warframe/Archwing.json"
import MeleeData from "@/data/warframe/Melee.json"
import MiscData from "@/data/warframe/Misc.json"
import PetsData from "@/data/warframe/Pets.json"
import PrimaryData from "@/data/warframe/Primary.json"
import SecondaryData from "@/data/warframe/Secondary.json"
import SentinelsData from "@/data/warframe/Sentinels.json"
import SentinelWeaponsData from "@/data/warframe/SentinelWeapons.json"
import WarframesData from "@/data/warframe/Warframes.json"

import { BROWSE_CATEGORIES } from "./categories"
import { slugify } from "./slugs"
import type {
  BrowseCategory,
  BrowseItem,
  BrowseFilters,
  BrowseableItem,
  SortOption,
} from "./types"

// Combined items array from all categories (loaded once at module init)
const allItems: BrowseableItem[] = [
  ...(WarframesData as BrowseableItem[]),
  ...(PrimaryData as BrowseableItem[]),
  ...(SecondaryData as BrowseableItem[]),
  ...(MeleeData as BrowseableItem[]),
  ...(SentinelsData as BrowseableItem[]),
  ...(PetsData as BrowseableItem[]),
  ...(ArchwingData as BrowseableItem[]),
  ...(ArchGunData as BrowseableItem[]),
  ...(ArchMeleeData as BrowseableItem[]),
  ...(SentinelWeaponsData as BrowseableItem[]),
  ...(MiscData as BrowseableItem[]),
]

// Precomputed caches to avoid repeated expensive work per request
const itemsByCategory = new Map<BrowseCategory, BrowseItem[]>()
const slugLookup = new Map<string, BrowseableItem>() // key: `${category}|${slug}`
const uniqueNameLookup = new Map<string, BrowseableItem>()
const categoryCounts: Record<BrowseCategory, number> = {
  warframes: 0,
  primary: 0,
  secondary: 0,
  melee: 0,
  necramechs: 0,
  companions: 0,
  "companion-weapons": 0,
  "exalted-weapons": 0,
  archwing: 0,
}

/**
 * Check if an item is a Necramech
 */
function isNecramech(item: BrowseableItem): boolean {
  return (
    item.category === "Warframes" &&
    (item.name.includes("Necramech") ||
      item.name === "Bonewidow" ||
      item.name === "Voidrig")
  )
}

/**
 * Map a raw WFCD item to our BrowseItem format
 */
function toBrowseItem(
  item: BrowseableItem,
  category: BrowseCategory,
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
    releaseDate: item.releaseDate,
  }
}

// Determine all browse categories an item belongs to
function categorizeItem(item: BrowseableItem): BrowseCategory[] {
  if (!item.name || item.name.includes(" Blueprint")) return []

  // Filter out items excluded from codex (PvP variants, duplicates)
  if ((item as { excludeFromCodex?: boolean }).excludeFromCodex) return []

  const itemCategory = item.category as string
  const itemType = (item as { type?: string }).type
  const categories: BrowseCategory[] = []

  if (itemCategory === "Warframes") {
    // Helminth is included in the Warframes dataset but is not a playable frame
    if (item.name === "Helminth") {
      return []
    }

    if (isNecramech(item)) {
      categories.push("necramechs")
    } else {
      categories.push("warframes")
    }
  }

  // Zaw Components: only include Strikes (have attacks array with data).
  // Filter out Grips and Links — they are not buildable items on their own.
  if (itemType === "Zaw Component") {
    const attacks = (item as { attacks?: { damage?: unknown }[] }).attacks
    const hasAttackData =
      attacks && attacks.length > 0 && attacks[0].damage != null
    if (hasAttackData) {
      categories.push("melee")
    }
    return categories
  }

  const isCompanionWeapon = itemType === "Companion Weapon"

  // Exclude companion weapons from primary/secondary/melee categories
  if (itemCategory === "Primary" && !isCompanionWeapon)
    categories.push("primary")
  if (itemCategory === "Secondary" && !isCompanionWeapon)
    categories.push("secondary")
  if (itemCategory === "Melee" && !isCompanionWeapon) categories.push("melee")
  if (itemCategory === "Sentinels" || itemCategory === "Pets") {
    categories.push("companions")
  }
  if (
    itemCategory === "Archwing" ||
    itemCategory === "Arch-Gun" ||
    itemCategory === "Arch-Melee"
  ) {
    categories.push("archwing")
  }

  // Companion weapons (sentinel weapons and pet weapons)
  if (isCompanionWeapon) {
    categories.push("companion-weapons")
  }

  // Exalted weapons (abilities that summon weapons)
  if (itemType === "Exalted Weapon") {
    categories.push("exalted-weapons")
  }

  return categories
}

// Build caches once
for (const config of BROWSE_CATEGORIES) {
  itemsByCategory.set(config.id, [])
}

for (const item of allItems) {
  uniqueNameLookup.set(item.uniqueName, item)

  const categories = categorizeItem(item)
  for (const category of categories) {
    const list = itemsByCategory.get(category)
    if (!list) continue

    const browseItem = toBrowseItem(item, category)
    list.push(browseItem)
    slugLookup.set(`${category}|${browseItem.slug}`, item)
  }
}

// Count items per category (sorting now happens client-side)
for (const [category, list] of itemsByCategory.entries()) {
  categoryCounts[category] = list.length
}

/**
 * Get all items for a specific browse category
 */
export function getItemsByCategory(category: BrowseCategory): BrowseItem[] {
  return itemsByCategory.get(category) ?? []
}

/**
 * Filter items based on browse filters
 */
export function filterItems(
  items: BrowseItem[],
  filters: Partial<BrowseFilters>,
): BrowseItem[] {
  const query = filters.query?.toLowerCase()
  const masteryMax = filters.masteryMax
  const primeOnly = filters.primeOnly
  const hideVaulted = filters.hideVaulted

  return items.filter((item) => {
    if (
      query &&
      !item.name.toLowerCase().includes(query) &&
      !item.type?.toLowerCase().includes(query)
    ) {
      return false
    }
    if (masteryMax !== undefined && (item.masteryReq ?? 0) > masteryMax) {
      return false
    }
    if (primeOnly && !item.isPrime) {
      return false
    }
    if (hideVaulted && item.vaulted) {
      return false
    }
    return true
  })
}

/**
 * Sort items based on sort option
 */
export function sortItems(
  items: BrowseItem[],
  sortOption: SortOption = "name-asc",
): BrowseItem[] {
  const result = [...items] // Don't mutate input

  switch (sortOption) {
    case "name-asc":
      return result.sort((a, b) => a.name.localeCompare(b.name))

    case "name-desc":
      return result.sort((a, b) => b.name.localeCompare(a.name))

    case "date-desc": // Newest first
      return result.sort((a, b) => {
        const dateA = a.releaseDate || "9999-12-31" // No date = sort to end
        const dateB = b.releaseDate || "9999-12-31"
        return dateB.localeCompare(dateA) // Descending
      })

    case "date-asc": // Oldest first
      return result.sort((a, b) => {
        const dateA = a.releaseDate || "9999-12-31" // No date = sort to end
        const dateB = b.releaseDate || "9999-12-31"
        return dateA.localeCompare(dateB) // Ascending
      })

    default:
      return result.sort((a, b) => a.name.localeCompare(b.name))
  }
}

/**
 * Get a single item by slug and category
 */
export function getItemBySlug(
  category: BrowseCategory,
  slug: string,
): BrowseableItem | null {
  const key = `${category}|${slug}`
  return slugLookup.get(key) ?? null
}

/**
 * Get items for static generation (top N items per category)
 */
export function getStaticItems(limit = 50): Array<{
  category: BrowseCategory
  slug: string
}> {
  const result: Array<{ category: BrowseCategory; slug: string }> = []

  for (const config of BROWSE_CATEGORIES) {
    const items = getItemsByCategory(config.id)
    // Prioritize prime items and popular frames
    const sorted = [...items].sort((a, b) => {
      // Primes first
      if (a.isPrime && !b.isPrime) return -1
      if (!a.isPrime && b.isPrime) return 1
      // Then alphabetically
      return a.name.localeCompare(b.name)
    })

    for (const item of sorted.slice(0, limit)) {
      result.push({
        category: config.id,
        slug: item.slug,
      })
    }
  }

  return result
}

/**
 * Get total count of items per category (for UI display)
 */
export function getCategoryCounts(): Record<BrowseCategory, number> {
  return categoryCounts
}

/**
 * Get an item by its WFCD unique name (category-agnostic)
 * Used for build creation validation and denormalization
 */
export function getItemByUniqueName(uniqueName: string): BrowseableItem | null {
  return uniqueNameLookup.get(uniqueName) ?? null
}

/**
 * Get denormalized item metadata for storing on builds
 * Returns the fields needed for Build records without an Item FK
 */
export function getItemMetadata(uniqueName: string): {
  uniqueName: string
  name: string
  imageName: string | null
  browseCategory: string
} | null {
  const item = uniqueNameLookup.get(uniqueName)
  if (!item) return null

  const categories = categorizeItem(item)
  if (categories.length === 0) return null

  return {
    uniqueName: item.uniqueName,
    name: item.name,
    imageName: (item as { imageName?: string }).imageName ?? null,
    browseCategory: categories[0],
  }
}

/**
 * Get full item data by unique name and category
 * Returns the complete item object with all fields
 */
export function getFullItem(
  category: BrowseCategory,
  uniqueName: string,
): BrowseableItem | null {
  // Validate the unique name exists at all
  const item = uniqueNameLookup.get(uniqueName)
  if (!item) return null

  // Ensure the item belongs to the requested category
  const categories = categorizeItem(item)
  if (categories.includes(category)) {
    return item
  }

  return null
}
