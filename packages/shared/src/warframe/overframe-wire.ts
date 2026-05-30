// Wire DTOs for the Overframe scrape endpoint — shared so the api producer and
// the web consumer can't drift (they previously kept separate copies, and the
// web `type` field had silently widened to `string`).

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

/**
 * Raw slot entry as emitted by Overframe. The client interprets slot_id
 * (1-8 = normal, 9/10 = aura/exilus or exilus/arcane depending on category,
 * 11+ = arcane) once it knows the matched item's category — see
 * `decodeOverframeSlotId`.
 */
export interface OverframeRawSlot {
  slot_id: number
  overframeId: string | null
  overframeName?: string
  rank: number
  polarityCode: number
  /** Mapped Polarity string when the code is known, else undefined. */
  polarity?: string
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
