import type { SlotId } from "@arsenyx/shared/warframe/build-data"
import {
  getPlexusSlotKind,
  isPlexusAuraMod,
  isPlexusMod,
  isStanceMod,
} from "@arsenyx/shared/warframe/mods"
import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"

import { plexusGroupForSlot } from "./plexus"
import { type ModSlotKind, slotKind } from "./slot-id"

function isAuraMod(mod: Mod): boolean {
  return mod.compatName?.toUpperCase() === "AURA"
}

function isExilusCompatible(mod: Mod): boolean {
  return Boolean(mod.isExilus || mod.isUtility)
}

/** The most specific slot kind a mod is made for (drives the card's slot
 *  badge). Aura mods also carry `isUtility`, so aura is checked before exilus;
 *  Plexus Matrix mods fill the Plexus aura slot without `compatName: AURA`. */
export function modSlotKind(mod: Mod): ModSlotKind {
  if (isStanceMod(mod)) return "stance"
  if (isAuraMod(mod) || isPlexusAuraMod(mod)) return "aura"
  if (isExilusCompatible(mod)) return "exilus"
  return "normal"
}

/** Whether a non-Plexus mod fits a slot of `kind`. */
export function fitsKind(mod: Mod, kind: ModSlotKind): boolean {
  switch (kind) {
    case "aura":
      return isAuraMod(mod)
    case "stance":
      return isStanceMod(mod)
    case "exilus":
      return !isAuraMod(mod) && !isStanceMod(mod) && isExilusCompatible(mod)
    case "normal":
      return !isAuraMod(mod) && !isStanceMod(mod)
  }
}

export function canPlaceIn(mod: Mod, id: SlotId): boolean {
  // Plexus Matrix mods only fit the aura slot; other Plexus mods only fit a
  // normal slot of their own group (Battle/Tactical/Integrated).
  if (isPlexusMod(mod)) {
    const k = slotKind(id)
    if (isPlexusAuraMod(mod)) return k === "aura"
    if (k !== "normal") return false
    const modGroup = getPlexusSlotKind(mod)
    return modGroup !== null && modGroup === plexusGroupForSlot(id)
  }
  return fitsKind(mod, slotKind(id))
}

/** Whether `mod` may sit as the Alternate in slot `id`: it must fit the slot
 *  and can never be a Riven (synthetic, configured, or catalog). */
export function canBeAlternate(mod: Mod, id: SlotId): boolean {
  if (isRivenMod(mod) || mod.rivenStats || mod.rarity === "Riven") return false
  return canPlaceIn(mod, id)
}

/** Slots to try, in order, when placing `mod` with no usable selection. */
export function candidateSlots(
  mod: Mod,
  auraIds: SlotId[],
  normalIds: SlotId[],
): SlotId[] {
  if (isPlexusMod(mod)) {
    if (isPlexusAuraMod(mod)) return auraIds
    const modGroup = getPlexusSlotKind(mod)
    if (!modGroup) return []
    return normalIds.filter((id) => plexusGroupForSlot(id) === modGroup)
  }
  if (isAuraMod(mod)) return auraIds
  if (isStanceMod(mod)) return ["stance"]
  if (isExilusCompatible(mod)) return ["exilus", ...normalIds]
  return normalIds
}
