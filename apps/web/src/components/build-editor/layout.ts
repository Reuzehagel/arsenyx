import type { BrowseCategory, DetailItem } from "@/lib/warframe"

/** Arcane slot count per category, mirroring legacy `src/lib/builds/layout.ts`. */
export function getArcaneSlotCount(category: BrowseCategory): number {
  switch (category) {
    case "warframes":
    case "necramechs":
      return 2
    case "primary":
    case "secondary":
    case "melee":
      return 1
    default:
      return 0
  }
}

/** Categories that have an Exilus slot. Necramechs and companions don't. */
export function hasExilusSlot(category: BrowseCategory): boolean {
  return category !== "necramechs" && category !== "companions"
}

/**
 * Number of Aura slots for an item. Warframes derive from `item.aura` —
 * an array means multiple aura slots (Jade: 2). Companions and other
 * categories have none.
 */
export function getAuraSlotCount(
  category: BrowseCategory,
  item: Pick<DetailItem, "aura">,
): number {
  if (category !== "warframes") return 0
  if (Array.isArray(item.aura)) return item.aura.length
  return item.aura ? 1 : 0
}

/** Normal mod slot count. Companions have 10; everything else has 8. */
export function getNormalSlotCount(category: BrowseCategory): number {
  return category === "companions" ? 10 : 8
}
