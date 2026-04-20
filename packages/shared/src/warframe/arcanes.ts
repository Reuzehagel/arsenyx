/**
 * Arcane compatibility helpers. Pure functions — caller supplies the raw WFCD
 * arcanes array. The build script filters the "clean" list once; the web app
 * further filters by browse category at runtime.
 */

import type { Arcane, BrowseCategory } from "./types"

/** Strip beta/excluded/empty entries from the raw WFCD arcane dump. */
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

export function getArcanesForSlot(
  arcanes: Arcane[],
  slotType: ArcaneSlotType,
): Arcane[] {
  return arcanes.filter((arcane) => {
    const type = arcane.type?.toLowerCase() ?? ""
    switch (slotType) {
      case "warframe":
        return type === "arcane" || type === "warframe arcane"
      case "operator":
        return type.includes("magus") || type.includes("operator")
      case "primary":
        return (
          type.includes("primary") ||
          type.includes("residua") ||
          type.includes("fractal")
        )
      case "secondary":
        return type.includes("secondary") || type.includes("pax")
      case "melee":
        return type.includes("melee") || type.includes("exodia")
      case "weapon":
        return (
          type.includes("primary") ||
          type.includes("residua") ||
          type.includes("fractal") ||
          type.includes("secondary") ||
          type.includes("pax") ||
          type.includes("melee") ||
          type.includes("exodia")
        )
      default:
        return false
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
