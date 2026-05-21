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

// "Zaw Arcane" covers Exodia arcanes (Zaw-only in-game, surfaced for any
// melee here to match the rest of the permissive pool).
const PRIMARY_TOKENS = ["primary", "residua", "fractal"] as const
const SECONDARY_TOKENS = ["secondary", "pax"] as const
const MELEE_TOKENS = ["melee", "zaw"] as const

const SLOT_TOKENS: Record<ArcaneSlotType, readonly string[]> = {
  warframe: [], // exact-match below
  operator: ["magus", "operator"],
  primary: PRIMARY_TOKENS,
  secondary: SECONDARY_TOKENS,
  melee: MELEE_TOKENS,
  weapon: [...PRIMARY_TOKENS, ...SECONDARY_TOKENS, ...MELEE_TOKENS],
}

/** Exodia / Zaw-only arcane (WFCD type "Zaw Arcane"). */
export function isZawArcane(arcane: Arcane): boolean {
  return (arcane.type?.toLowerCase() ?? "").includes("zaw")
}

export function getArcanesForSlot(
  arcanes: Arcane[],
  slotType: ArcaneSlotType,
): Arcane[] {
  return arcanes.filter((arcane) => {
    const type = arcane.type?.toLowerCase() ?? ""
    if (slotType === "warframe") {
      return type === "arcane" || type === "warframe arcane"
    }
    return SLOT_TOKENS[slotType].some((t) => type.includes(t))
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
