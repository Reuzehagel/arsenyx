/**
 * Arcane compatibility helpers. Pure functions — caller supplies the
 * arcanes array emitted by `scripts/build/merge-arcanes.ts`, which sets
 * `type` from the DE sub-path: one of `Defensive | Offensive | Utility |
 * Zariman | Amp | Operator`. Those effect-style buckets don't map to
 * equip slots, so slot eligibility is derived from arcane names below.
 */

import type { Arcane, BrowseCategory } from "./types"

/** Strip beta/excluded/empty entries from the raw arcane dump. */
export function normalizeArcanes(rawArcanes: Arcane[]): Arcane[] {
  return rawArcanes.filter((arcane) => {
    if (!arcane.name) return false
    if (arcane.name === "Arcane") return false
    if ((arcane as { excludeFromCodex?: boolean }).excludeFromCodex)
      return false
    return true
  })
}

export type ArcaneSlotType =
  | "warframe"
  | "operator"
  | "primary"
  | "secondary"
  | "melee"
  | "weapon"

// Name tokens — DE's sub-path buckets (Utility/Defensive/Offensive/Zariman)
// mix frame and weapon arcanes together, so we route by name. "Zaw" tokens
// surface Exodia (Zaw-only in-game) on every melee, matching the
// permissive pool we've always shown.
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

/** Exodia / Zaw-only arcane — detected by name (the type bucket no longer
 *  distinguishes these from other melee arcanes). */
export function isZawArcane(arcane: Arcane): boolean {
  const n = arcane.name.toLowerCase()
  return n.includes("exodia") || n.includes("zaw")
}

/** Operator/Amp arcane — sits in a different equip section from the
 *  weapon/frame arcanes and should never appear in those pickers. */
function isOperatorOrAmpArcane(arcane: Arcane): boolean {
  const t = arcane.type ?? ""
  return t === "Operator" || t === "Amp"
}

export function getArcanesForSlot(
  arcanes: Arcane[],
  slotType: ArcaneSlotType,
): Arcane[] {
  return arcanes.filter((arcane) => {
    if (slotType === "operator") return isOperatorOrAmpArcane(arcane)
    if (isOperatorOrAmpArcane(arcane)) return false
    switch (slotType) {
      case "warframe":
        // Anything that isn't a weapon-token arcane (Pax, Primary, Residua,
        // Exodia, …) is a frame arcane.
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
