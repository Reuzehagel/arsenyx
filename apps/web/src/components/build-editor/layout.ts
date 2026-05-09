import {
  getArcanesForCategory,
  getArcanesForSlot,
} from "@arsenyx/shared/warframe/arcanes"
import type { Arcane } from "@arsenyx/shared/warframe/types"

import type { BrowseCategory, DetailItem } from "@/lib/warframe"

/** Arcane slot count per category. Within `archwing`, only arch-guns
 * have arcane slots (slot 0 = Primary Arcane, slot 1 = Secondary Arcane —
 * matches the in-game arsenal); archwing suits and arch-melee weapons
 * have none. */
export function getArcaneSlotCount(
  category: BrowseCategory,
  itemType: DetailItem["type"],
): number {
  switch (category) {
    case "warframes":
      return 2
    case "primary":
    case "secondary":
    case "melee":
      return 1
    case "archwing":
      return itemType === "Arch-Gun" ? 2 : 0
    default:
      return 0
  }
}

/** Per-slot arcane picker config. Arch-guns get typed slots (one primary,
 * one secondary, with matching labels); every other category gets the
 * same shared option list across all slots and no custom labels. */
export interface ArcaneSlotConfig {
  options: Arcane[][]
  labels?: string[]
}

export function getArcaneSlotConfig(
  allArcanes: Arcane[],
  category: BrowseCategory,
  count: number,
): ArcaneSlotConfig {
  if (count === 0) return { options: [] }
  if (category === "archwing") {
    return {
      options: [
        getArcanesForSlot(allArcanes, "primary"),
        getArcanesForSlot(allArcanes, "secondary"),
      ],
      labels: ["Primary Arcane", "Secondary Arcane"],
    }
  }
  const shared = getArcanesForCategory(allArcanes, category)
  return { options: Array.from({ length: count }, () => shared) }
}

/** Categories that have an Exilus slot. Necramechs, companions, and every
 * archwing-category item (suits, arch-guns, arch-melee) don't. */
export function hasExilusSlot(category: BrowseCategory): boolean {
  return (
    category !== "necramechs" &&
    category !== "companions" &&
    category !== "archwing"
  )
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

/** Normal mod slot count. Companions have 10, necramechs have 12, everything else 8. */
export function getNormalSlotCount(category: BrowseCategory): number {
  if (category === "companions") return 10
  if (category === "necramechs") return 12
  return 8
}

/**
 * Max rank for an item. Necramechs overlevel to 40 (not flagged in WFCD data).
 * Kuva/Tenet/Coda weapons + Paracesis carry `maxLevelCap: 40` in their JSON.
 * Undefined for normal-rank items; `calculateCapacity` treats that as 30.
 */
export function getMaxLevelCap(
  category: BrowseCategory,
  item: Pick<DetailItem, "maxLevelCap">,
): number | undefined {
  if (category === "necramechs") return 40
  return item.maxLevelCap
}

// Paracesis also carries maxLevelCap: 40 but has no Lich bonus element —
// gate on the name prefix so it's excluded.
const LICH_WEAPON_PREFIXES = ["Kuva ", "Tenet ", "Coda "]

export function isLichWeapon(
  item: Pick<DetailItem, "name" | "maxLevelCap">,
): boolean {
  if (item.maxLevelCap !== 40) return false
  return LICH_WEAPON_PREFIXES.some((p) => item.name.startsWith(p))
}
