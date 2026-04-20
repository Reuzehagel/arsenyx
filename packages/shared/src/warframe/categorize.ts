import { BROWSE_CATEGORIES } from "./categories"
import { slugify } from "./slugs"
import type { BrowseCategory, BrowseItem, BrowseableItem } from "./types"

function isNecramech(item: BrowseableItem): boolean {
  return (
    item.category === "Warframes" &&
    (item.name.includes("Necramech") ||
      item.name === "Bonewidow" ||
      item.name === "Voidrig")
  )
}

export function toBrowseItem(
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

export function categorizeItem(item: BrowseableItem): BrowseCategory[] {
  if (!item.name || item.name.includes(" Blueprint")) return []

  const itemCategory = item.category as string
  const itemType = (item as { type?: string }).type

  if (
    (item as { excludeFromCodex?: boolean }).excludeFromCodex &&
    itemType !== "Exalted Weapon"
  )
    return []

  const categories: BrowseCategory[] = []

  if (itemCategory === "Warframes") {
    if (item.name === "Helminth") return []
    if (isNecramech(item)) categories.push("necramechs")
    else categories.push("warframes")
  }

  if (itemType === "Zaw Component") {
    const attacks = (item as { attacks?: { damage?: unknown }[] }).attacks
    const hasAttackData =
      attacks && attacks.length > 0 && attacks[0].damage != null
    if (hasAttackData) categories.push("melee")
    return categories
  }

  const isCompanionWeapon = itemType === "Companion Weapon"

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

  if (isCompanionWeapon) categories.push("companion-weapons")
  if (itemType === "Exalted Weapon") categories.push("exalted-weapons")

  return categories
}

export interface BuiltIndex {
  byCategory: Record<BrowseCategory, BrowseItem[]>
  slugLookup: Map<string, BrowseableItem>
}

export function buildIndex(allItems: BrowseableItem[]): BuiltIndex {
  const byCategory = Object.fromEntries(
    BROWSE_CATEGORIES.map((c) => [c.id, []]),
  ) as Record<BrowseCategory, BrowseItem[]>

  const slugLookup = new Map<string, BrowseableItem>()

  for (const item of allItems) {
    for (const category of categorizeItem(item)) {
      const browseItem = toBrowseItem(item, category)
      byCategory[category].push(browseItem)
      slugLookup.set(`${category}|${browseItem.slug}`, item)
    }
  }

  return { byCategory, slugLookup }
}
