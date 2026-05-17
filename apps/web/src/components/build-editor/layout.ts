import {
  getArcanesForCategory,
  getArcanesForSlot,
  type ArcaneSlotType,
} from "@arsenyx/shared/warframe/arcanes"
import type { Arcane } from "@arsenyx/shared/warframe/types"

import type { BrowseCategory, DetailItem } from "@/lib/warframe"

/** Resolve which arcane pool an exalted weapon draws from. Mirrors the
 * mod-pool logic in `getModsForItem`: bows take primary arcanes,
 * trigger-bearing weapons (Balefire/Regulators) take secondary, everything
 * else (Exalted Blade etc.) takes melee. */
function getExaltedArcaneSlot(
  item: Pick<DetailItem, "name" | "trigger">,
): ArcaneSlotType {
  if (item.name?.toLowerCase().includes("bow")) return "primary"
  if (item.trigger) return "secondary"
  return "melee"
}

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
    case "exalted-weapons":
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
  item?: Pick<DetailItem, "name" | "trigger">,
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
  if (category === "exalted-weapons" && item) {
    const slot = getExaltedArcaneSlot(item)
    return { options: [getArcanesForSlot(allArcanes, slot)] }
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
 * Whether to render a Stance slot. Driven by the item carrying a
 * `stancePolarity` (set by WFCD on every melee and on some exalted melees).
 * Arch-melee weapons do not carry stancePolarity and so get no slot.
 * Exalted melees have a stance pre-applied in-game and the player cannot
 * swap it, so we skip the slot entirely for the `exalted-weapons` category.
 */
export function hasStanceSlot(
  item: Pick<DetailItem, "stancePolarity">,
  category: BrowseCategory,
): boolean {
  if (category === "exalted-weapons") return false
  return Boolean(item.stancePolarity)
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
