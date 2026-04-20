import type { BrowseCategory } from "@/lib/warframe"

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

/** Categories with an Aura slot (polarity bonus to capacity). */
export function hasAuraSlot(category: BrowseCategory): boolean {
  return category === "warframes" || category === "companions"
}
