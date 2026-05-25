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

export interface OverframeMatchedMod {
  overframeId: string
  overframeName?: string
  rank: number
  slotId: string // e.g. "aura-0", "exilus-0", "normal-3"
  slotPolarityCode?: number
  slotPolarity?: string
  matched?: {
    uniqueName: string
    name: string
    score: number // 0..1, higher = better
  }
}

export interface OverframeSlotPolarity {
  slotId: string // aura-0, exilus-0, normal-0..7
  polarityCode: number
  polarity?: string // mapped to our Polarity strings when known
}

export interface OverframeMatchedItem {
  overframeName?: string
  matched?: {
    uniqueName: string
    name: string
    category: string
    score: number // 0..1
  }
}

export interface OverframeMatchedArcane {
  overframeId: string
  overframeName?: string
  rank: number
  slotIndex: number // 0 for weapons, 0-1 for warframes
  matched?: {
    uniqueName: string
    name: string
    imageName?: string
    rarity: string
    score: number
  }
}

export interface OverframeMatchedHelminthAbility {
  slotIndex: number
  overframeUniqueName: string
  matched?: {
    uniqueName: string
    name: string
    imageName?: string
    source: string
    description?: string
  }
}

export interface OverframeImportResponse {
  source: OverframeBuildSource
  item: OverframeMatchedItem
  formaCount: number | null
  mods: OverframeMatchedMod[]
  arcanes?: OverframeMatchedArcane[]
  helminthAbility?: OverframeMatchedHelminthAbility
  slotPolarities?: OverframeSlotPolarity[]
  warnings: OverframeImportWarning[]
  debug?: {
    extractedKeys?: string[]
  }
}
