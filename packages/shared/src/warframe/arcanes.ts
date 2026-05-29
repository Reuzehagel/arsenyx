/**
 * Arcane compatibility helpers. Pure functions — caller supplies the
 * arcanes array emitted by `scripts/build/merge-arcanes.ts`. Slot eligibility
 * routes on each arcane's wiki `slotType` (the authoritative equip slot:
 * Warframe / Primary / Secondary / Melee / Kitgun / Zaw / Operator / …). DE's
 * `type` is an effect bucket (Offensive/Utility/…), not a slot; the name-token
 * heuristic below is only a fallback for arcanes missing a `slotType`.
 */

import type { Arcane, BrowseCategory } from "./types"

export type ArcaneSlotType =
  | "warframe"
  | "operator"
  | "primary"
  | "secondary"
  | "melee"
  | "weapon"

// Fallback name tokens — used only for the rare arcane that lacks a wiki
// `slotType`. DE's sub-path bucket (Utility/Defensive/…) is an effect type,
// not an equip slot, so these approximate the slot from the name.
const PRIMARY_TOKENS = ["primary", "residua", "fractal"] as const
const SECONDARY_TOKENS = ["secondary", "pax"] as const
const MELEE_TOKENS = ["melee", "zaw", "exodia"] as const
const WEAPON_TOKENS = [
  ...PRIMARY_TOKENS,
  ...SECONDARY_TOKENS,
  ...MELEE_TOKENS,
] as const

function nameMatches(arcane: Arcane, tokens: readonly string[]): boolean {
  const n = arcane.name.toLowerCase()
  return tokens.some((t) => n.includes(t))
}

/** Exodia / Zaw-only arcane — detected by name so callers can split the
 *  melee pool into Exodia (Zaw) vs ordinary melee arcanes. */
export function isZawArcane(arcane: Arcane): boolean {
  const n = arcane.name.toLowerCase()
  return n.includes("exodia") || n.includes("zaw")
}

/** Operator-side arcane (Operator / Amp / Tektolyst) — never on a
 *  weapon/frame slot. */
function isOperatorOrAmpArcane(arcane: Arcane): boolean {
  const slot = arcane.slotType
  if (slot) return isOperatorSlot(slot)
  return arcane.type === "Operator" || arcane.type === "Amp"
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
    case "weapon":
      return slot !== "Warframe" && !isOperatorSlot(slot)
  }
}

function isOperatorSlot(slot: string): boolean {
  return slot === "Operator" || slot === "Amp" || slot === "Tektolyst Artifacts"
}

/** Kitgun weapons (Catchmoon / Gaze / Rattleguts / Tombfinger / Vermisplicer
 *  / Sporelacer, built as primary OR secondary) — identified by their modular
 *  barrel `uniqueName` path. Primary kitguns report a normal weapon
 *  `displayClass` ("Shotgun"/"Rifle"/"Launcher") but aren't real shotguns/
 *  rifles, so they must be detected structurally, not by class. Kitguns are
 *  the only weapons that accept Kitgun arcanes (Pax / Residual). */
export function isKitgunWeapon(weapon: { uniqueName?: string }): boolean {
  const u = weapon.uniqueName ?? ""
  return u.includes("SUModular") || u.includes("InfKitGun")
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
  const kitgun = isKitgunWeapon(weapon)
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
        // Generic Primary/Secondary arcanes, or fallback-routed arcanes with
        // no wiki slotType, fit any weapon in their base slot.
        return true
    }
  })
}

export function getArcanesForSlot(
  arcanes: Arcane[],
  slotType: ArcaneSlotType,
): Arcane[] {
  return arcanes.filter((arcane) => {
    // Authoritative: route on the wiki equip slot.
    if (arcane.slotType) return slotTypeMatches(arcane.slotType, slotType)
    // Fallback (no wiki slotType): legacy name-token routing.
    if (slotType === "operator") return isOperatorOrAmpArcane(arcane)
    if (isOperatorOrAmpArcane(arcane)) return false
    switch (slotType) {
      case "warframe":
        return !nameMatches(arcane, WEAPON_TOKENS)
      case "primary":
        return nameMatches(arcane, PRIMARY_TOKENS)
      case "secondary":
        return nameMatches(arcane, SECONDARY_TOKENS)
      case "melee":
        return nameMatches(arcane, MELEE_TOKENS)
      case "weapon":
        return nameMatches(arcane, WEAPON_TOKENS)
    }
  })
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
    case "archwing":
      return [
        ...getArcanesForSlot(arcanes, "primary"),
        ...getArcanesForSlot(arcanes, "secondary"),
      ]
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
