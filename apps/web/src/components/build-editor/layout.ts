import {
  getArcanesForCategory,
  getArcanesForSlot,
  getArcanesForWeapon,
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

/** Zaw strikes are emitted as individual items with a wiki Class like
 *  "Zaw Dagger / Staff", "Zaw Polearm / Hammer", etc. The "Zaw " prefix is
 *  the stable marker — we treat the whole family as Zaw components for
 *  layout purposes (extra Exodia arcane slot, single-slot stance pool). */
function isZawComponent(displayClass: DetailItem["displayClass"]): boolean {
  return displayClass?.startsWith("Zaw ") ?? false
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
  displayClass: DetailItem["displayClass"],
): number {
  switch (category) {
    case "warframes":
      return 2
    case "melee":
      // Zaws have a dedicated Exodia slot in addition to the regular Melee
      // Arcane slot — both can be active simultaneously in-game.
      return isZawComponent(displayClass) ? 2 : 1
    case "primary":
    case "secondary":
    case "exalted-weapons":
      return 1
    case "archwing":
      // Wiki Class is "Archgun" (no hyphen) for arch-gun primaries.
      return displayClass === "Archgun" ? 2 : 0
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
  item?: Pick<DetailItem, "name" | "trigger" | "displayClass" | "uniqueName">,
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
  if (category === "melee" && item && isZawComponent(item.displayClass)) {
    const regular: Arcane[] = []
    const exodia: Arcane[] = []
    for (const a of getArcanesForSlot(allArcanes, "melee")) {
      ;(isZawArcane(a) ? exodia : regular).push(a)
    }
    return { options: [regular, exodia], labels: ["Melee Arcane", "Exodia"] }
  }
  // Primary/secondary: gate the weapon-type sub-pools (Shotgun/Bow/Kitgun
  // arcanes) by this weapon's own class so e.g. a rifle doesn't see shotgun
  // or kitgun arcanes. Falls back to the broad per-category pool when we have
  // no item to inspect.
  if (category === "primary" || category === "secondary") {
    const shared = item
      ? getArcanesForWeapon(allArcanes, category, item)
      : getArcanesForCategory(allArcanes, category)
    return { options: Array.from({ length: count }, () => shared) }
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
  item: Pick<DetailItem, "displayClass">,
  arcanes: (PlacedArcane | null)[] | undefined,
): (PlacedArcane | null)[] | undefined {
  if (!isZawComponent(item.displayClass) || !arcanes) return arcanes
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
 * `stancePolarity` (present on every melee and on some exalted melees).
 * Arch-melee weapons do not carry stancePolarity and so get no slot.
 * Exalted melees have a stance pre-applied in-game and the player cannot
 * swap it, so we skip the slot entirely for the `exalted-weapons` category.
 *
 * Zaw strike components are user-built melees that carry no stancePolarity
 * on the strike entry but absolutely do equip a stance in-game — always
 * surface the slot (innate polarity unknown; user can forma).
 */
export function hasStanceSlot(
  item: Pick<DetailItem, "stancePolarity" | "displayClass">,
  category: BrowseCategory,
): boolean {
  if (category === "exalted-weapons") return false
  if (category === "railjack") return false
  if (isZawComponent(item.displayClass)) return true
  return Boolean(item.stancePolarity)
}

/**
 * Number of Aura slots for an item. Warframes derive from
 * `item.auraPolarity` — an array means multiple aura slots (Jade: 2).
 * Companions and other categories have none.
 */
export function getAuraSlotCount(
  category: BrowseCategory,
  item: Pick<DetailItem, "auraPolarity">,
): number {
  // Plexus has an Aura slot in the Integrated section — accepts any Plexus
  // mod and inverts drain to a capacity bonus. The Plexus-mod placement
  // override lives in `use-build-slots.ts` (canPlaceIn / candidateSlots);
  // capacity math reuses `auraBonusForMod` without changes.
  if (category === "railjack") return 1
  if (category !== "warframes") return 0
  if (Array.isArray(item.auraPolarity)) return item.auraPolarity.length
  return item.auraPolarity ? 1 : 0
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
 * Max rank for an item. Necramechs overlevel to 40 (not flagged in the item data).
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
