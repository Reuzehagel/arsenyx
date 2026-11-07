// Wire DTOs for the Overframe scrape endpoint — shared so the api producer and
// the web consumer can't drift (they previously kept separate copies, and the
// web `type` field had silently widened to `string`).

import type { OverframeSlotType } from "./overframe-slots"
import type { Polarity } from "./polarities"

export interface OverframeImportWarning {
  type:
    | "build_data_missing"
    | "buildstring_missing"
    | "buildstring_decode_failed"
    | "item_not_found"
    | "mod_not_found"
    | "helminth_ability_not_found"
  message: string
  details?: Record<string, unknown>
}

/**
 * Raw slot entry as emitted by Overframe. The client interprets slot_id
 * (1-8 = normal, 9/10 = aura/exilus or exilus/arcane depending on category,
 * 11+ = arcane) once it knows the matched item's category — see
 * `decodeOverframeSlotId`.
 */
export interface OverframeRawSlot {
  slot_id: number
  /** Set on slots decoded from a buildstring, whose position gives a slot
   *  type but no category: the client re-encodes these against the matched
   *  item's category (`encodeOverframeSlotId`) instead of reading `slot_id`,
   *  which then is only the warframe encoding. */
  slotType?: OverframeSlotType
  slotIndex?: number
  overframeId: string | null
  overframeName?: string
  rank: number
  polarityCode: number
  /** Mapped polarity when the code is known, else undefined. */
  polarity?: Polarity
}

/**
 * Raw scrape response. The client matches item/mods/arcanes against our catalog data
 * and interprets the slot_id layout.
 */
export interface OverframeScrapeResponse {
  source: {
    url: string
    pageTitle?: string
    pageDescription?: string
    guideDescription?: string
    buildId?: string
    buildString?: string
  }
  itemName?: string
  formaCount: number | null
  slots: OverframeRawSlot[]
  helminthAbility?: { slotIndex: number; uniqueName: string }
  warnings: OverframeImportWarning[]
}
