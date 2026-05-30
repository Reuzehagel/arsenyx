export type OverframeSlotType = "aura" | "exilus" | "normal" | "arcane"

export interface OverframeDecodedSlot {
  overframeId: string
  rank: number
  slotType: OverframeSlotType
  slotIndex: number // index within its type (normal: 0-7)
}

export interface OverframeBuildSource {
  url: string
  pageTitle?: string
  pageDescription?: string
  guideDescription?: string
  buildId?: string
  buildString?: string
}

// Canonical definition lives in @arsenyx/shared so the web consumer can't
// drift from the api producer. Imported for use below + re-exported for
// existing `./types` consumers.
import type { OverframeImportWarning } from "@arsenyx/shared/warframe/overframe-wire"

export type { OverframeImportWarning }
