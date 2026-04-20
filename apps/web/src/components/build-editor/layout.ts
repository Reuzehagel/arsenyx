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

/** Categories that have an Exilus slot. Necramechs don't; everything else does. */
export function hasExilusSlot(category: BrowseCategory): boolean {
  return category !== "necramechs"
}

/**
 * Number of Aura slots for an item. Warframes derive from `item.aura` —
 * an array means multiple aura slots (Jade: 2). Companions always have 1.
 */
export function getAuraSlotCount(
  category: BrowseCategory,
  item: Pick<DetailItem, "aura">,
): number {
  if (category === "companions") return 1
  if (category !== "warframes") return 0
  if (Array.isArray(item.aura)) return item.aura.length
  return item.aura ? 1 : 0
}
