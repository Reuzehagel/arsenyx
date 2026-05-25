import {
  getArcanesForCategory,
  getArcanesForSlot,
  isZawArcane,
  type ArcaneSlotType,
} from "@arsenyx/shared/warframe/arcanes"
import type { Arcane } from "@arsenyx/shared/warframe/types"

import type { BrowseCategory, DetailItem } from "@/lib/warframe"

import type { PlacedArcane } from "./use-arcane-slots"

// Category-only slot facts live in shared (the api Overframe importer needs
// them too). Re-exported here so editor call sites keep importing from the
// build-editor barrel.
export {
  getNormalSlotCount,
  hasExilusSlot,
} from "@arsenyx/shared/warframe/slot-layout"

function isZawComponent(itemType: DetailItem["type"]): boolean {
  return itemType === "Zaw Component"
}

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
    case "melee":
      // Zaws have a dedicated Exodia slot in addition to the regular Melee
      // Arcane slot — both can be active simultaneously in-game.
      return isZawComponent(itemType) ? 2 : 1
    case "primary":
    case "secondary":
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
  item?: Pick<DetailItem, "name" | "trigger" | "type">,
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
  if (category === "melee" && item && isZawComponent(item.type)) {
    const regular: Arcane[] = []
    const exodia: Arcane[] = []
    for (const a of getArcanesForSlot(allArcanes, "melee")) {
      ;(isZawArcane(a) ? exodia : regular).push(a)
    }
    return { options: [regular, exodia], labels: ["Melee Arcane", "Exodia"] }
  }
  const shared = getArcanesForCategory(allArcanes, category)
  return { options: Array.from({ length: count }, () => shared) }
}

/**
 * Initial arcane placement for the editor hook. For Zaws, routes a saved
 * Exodia to slot 1 and regular melee arcanes to slot 0 — older Zaw builds
 * were saved with a single melee arcane slot, so the saved index is no
 * longer authoritative.
 */
export function resolveInitialArcanes(
  item: Pick<DetailItem, "type">,
  arcanes: (PlacedArcane | null)[] | undefined,
): (PlacedArcane | null)[] | undefined {
  if (!isZawComponent(item.type) || !arcanes) return arcanes
  const out: (PlacedArcane | null)[] = [null, null]
  for (const a of arcanes) {
    if (!a) continue
    const idx = isZawArcane(a.arcane) ? 1 : 0
    if (!out[idx]) out[idx] = a
  }
  return out
}

/**
 * Whether to render a Stance slot. Driven by the item carrying a
 * `stancePolarity` (set by WFCD on every melee and on some exalted melees).
 * Arch-melee weapons do not carry stancePolarity and so get no slot.
 * Exalted melees have a stance pre-applied in-game and the player cannot
 * swap it, so we skip the slot entirely for the `exalted-weapons` category.
 *
 * Zaw strike components are user-built melees that carry no stancePolarity
 * on the strike entry but absolutely do equip a stance in-game — always
 * surface the slot (innate polarity unknown; user can forma).
 */
export function hasStanceSlot(
  item: Pick<DetailItem, "stancePolarity" | "type">,
  category: BrowseCategory,
): boolean {
  if (category === "exalted-weapons") return false
  if (category === "railjack") return false
  if (isZawComponent(item.type)) return true
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
  // Plexus has an Aura slot in the Integrated section — accepts any Plexus
  // mod and inverts drain to a capacity bonus. The Plexus-mod placement
  // override lives in `use-build-slots.ts` (canPlaceIn / candidateSlots);
  // capacity math reuses `auraBonusForMod` without changes.
  if (category === "railjack") return 1
  if (category !== "warframes") return 0
  if (Array.isArray(item.aura)) return item.aura.length
  return item.aura ? 1 : 0
}

// =============================================================================
// PLEXUS SLOT GROUPS
// =============================================================================

export type PlexusGroupKind = "battle" | "tactical" | "integrated"

export interface PlexusGroup {
  kind: PlexusGroupKind
  label: string
  count: number
}

/** Plexus normal-slot layout in render order. Order mirrors the picker
 * tabs (integrated → battle → tactical). Indices map left-to-right:
 *  0..7 → integrated, 8..10 → battle, 11..13 → tactical. */
export const PLEXUS_GROUPS: PlexusGroup[] = [
  { kind: "integrated", label: "Integrated", count: 8 },
  { kind: "battle", label: "Battle", count: 3 },
  { kind: "tactical", label: "Tactical", count: 3 },
]

/** Group kind for a normal-slot index. Returns null for non-railjack items. */
export function getPlexusGroupForIndex(
  category: BrowseCategory,
  index: number,
): PlexusGroupKind | null {
  if (category !== "railjack") return null
  let acc = 0
  for (const g of PLEXUS_GROUPS) {
    if (index < acc + g.count) return g.kind
    acc += g.count
  }
  return null
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
