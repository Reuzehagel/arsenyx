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

export interface OverframeImportWarning {
  type:
    | "invalid_url"
    | "fetch_failed"
    | "next_data_missing"
    | "build_data_missing"
    | "buildstring_missing"
    | "buildstring_decode_failed"
    | "item_not_found"
    | "mod_not_found"
    | "helminth_ability_not_found"
  message: string
  details?: Record<string, unknown>
}

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
