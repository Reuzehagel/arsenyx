/**
 * Arcane compatibility helpers. Pure functions — caller supplies the
 * arcanes array emitted by `scripts/build/merge-arcanes.ts`. Slot eligibility
 * routes on each arcane's wiki `slotType` (the authoritative equip slot:
 * Warframe / Primary / Secondary / Melee / Kitgun / Zaw / Operator / …). DE's
 * `type` is an effect bucket (Offensive/Utility/…), not a slot, so it is never
 * used for routing. Every catalog arcane carries a `slotType`; one that somehow
 * lacks it is treated as un-routable (placed in no slot) rather than guessed at.
 */

import { isKitgunChamber } from "./kitgun-data"
import type { Arcane, BrowseCategory } from "./types"

export type ArcaneSlotType =
  | "warframe"
  | "operator"
  | "primary"
  | "secondary"
  | "melee"

/** Exodia / Zaw-only arcane — lets callers split the melee pool into Exodia
 *  (Zaw) vs ordinary melee arcanes. */
export function isZawArcane(arcane: Arcane): boolean {
  return arcane.slotType === "Zaw"
}

/** Pax / Residual — the arcanes for a Kitgun's dedicated second arcane slot
 *  (the Zaw counterpart is `isZawArcane`). */
export function isKitgunArcane(arcane: Arcane): boolean {
  return arcane.slotType === "Kitgun"
}

/** Map the wiki `slotType` to one of our equip-slot buckets. Kitgun arcanes
 *  go on both primary and secondary (a kitgun can be built either way); Zaw
 *  arcanes ride the melee slot; Bow/Shotgun are primary sub-types. */
function slotTypeMatches(slot: string, target: ArcaneSlotType): boolean {
  switch (target) {
    case "warframe":
      return slot === "Warframe"
    case "operator":
      return isOperatorSlot(slot)
    case "primary":
      return (
        slot === "Primary" ||
        slot === "Bow" ||
        slot === "Shotgun" ||
        slot === "Kitgun"
      )
    case "secondary":
      return slot === "Secondary" || slot === "Kitgun"
    case "melee":
      return slot === "Melee" || slot === "Zaw"
  }
}

function isOperatorSlot(slot: string): boolean {
  return slot === "Operator" || slot === "Amp" || slot === "Tektolyst Artifacts"
}

/** Arcanes equippable on a SPECIFIC primary/secondary weapon. Unlike
 *  `getArcanesForSlot` (the broad per-slot pool used by browse/archwing), this
 *  gates the weapon-type sub-pools by the weapon's own class: a rifle sees
 *  only generic Primary arcanes; a shotgun adds Shotgun arcanes; a bow adds
 *  Bow arcanes; only kitguns see Kitgun (Pax/Residual) arcanes. Wiki-verified:
 *  Shotgun Vendetta is shotgun-only, Longbow Sharpshot bow-only, Pax/Residual
 *  kitgun-only. */
export function getArcanesForWeapon(
  arcanes: Arcane[],
  category: "primary" | "secondary",
  weapon: { displayClass?: string; uniqueName?: string },
): Arcane[] {
  // Primary kitguns report a normal weapon displayClass ("Shotgun"/"Rifle"/
  // "Launcher") but aren't real shotguns/rifles, so detect them structurally.
  const kitgun = isKitgunChamber(weapon.uniqueName)
  const dc = weapon.displayClass
  return getArcanesForSlot(arcanes, category).filter((a) => {
    switch (a.slotType) {
      case "Kitgun":
        return kitgun
      case "Shotgun":
        return !kitgun && dc === "Shotgun"
      case "Bow":
        return !kitgun && dc === "Bow"
      default:
        // Generic Primary/Secondary arcanes fit any weapon in their base slot.
        return true
    }
  })
}

export function getArcanesForSlot(
  arcanes: Arcane[],
  slotType: ArcaneSlotType,
): Arcane[] {
  // Route purely on the authoritative wiki equip slot. An arcane with no
  // slotType (absent from all shipping data) is placed in no slot.
  return arcanes.filter(
    (arcane) => !!arcane.slotType && slotTypeMatches(arcane.slotType, slotType),
  )
}

/** Arcanes compatible with a browse category. */
export function getArcanesForCategory(
  arcanes: Arcane[],
  category: BrowseCategory,
): Arcane[] {
  switch (category) {
    case "warframes":
    case "necramechs":
      return getArcanesForSlot(arcanes, "warframe")
    case "primary":
      return getArcanesForSlot(arcanes, "primary")
    case "secondary":
      return getArcanesForSlot(arcanes, "secondary")
    case "melee":
      return getArcanesForSlot(arcanes, "melee")
    default:
      return []
  }
}
