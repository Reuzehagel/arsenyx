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
