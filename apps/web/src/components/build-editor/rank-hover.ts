import { createContext, useContext } from "react"

import type { SlotId } from "./use-build-slots"

/**
 * Which placed card the pointer is currently over, for the single rank-hotkey
 * owner in editor-shell. Only one card can be hovered at a time, so routing
 * `-`/`+` through one owner (hovered ?? selected) is what stops the old
 * multi-fire: a *selected* mod slot and a *separately hovered* one would each
 * register their own window listener and both rank on a single keypress.
 */
export type RankHoverTarget =
  | { kind: "mod"; id: SlotId }
  | { kind: "arcane"; index: number }

export interface RankHoverApi {
  /** Mark this card as the hovered rank target (called on pointer-enter). */
  set: (target: RankHoverTarget) => void
  /**
   * Clear the hovered target, but only if `target` is still the current one.
   * Guards against a late leave from a card the pointer already moved off of
   * (enter B → leave A ordering) wiping B's registration.
   */
  clear: (target: RankHoverTarget) => void
}

export function rankTargetsEqual(
  a: RankHoverTarget,
  b: RankHoverTarget,
): boolean {
  if (a.kind === "mod" && b.kind === "mod") return a.id === b.id
  if (a.kind === "arcane" && b.kind === "arcane") return a.index === b.index
  return false
}

// null outside the editor: the read-only viewer / embed never provide it, so
// the hover wiring in ModSlot / ArcaneCard degrades to a no-op there.
const RankHoverContext = createContext<RankHoverApi | null>(null)

export const RankHoverProvider = RankHoverContext.Provider

export function useRankHover(): RankHoverApi | null {
  return useContext(RankHoverContext)
}
