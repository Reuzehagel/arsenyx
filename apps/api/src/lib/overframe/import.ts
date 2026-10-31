import { encodeOverframeSlotId } from "@arsenyx/shared/warframe/overframe-slots"
import type {
  OverframeImportWarning,
  OverframeRawSlot,
  OverframeScrapeResponse,
} from "@arsenyx/shared/warframe/overframe-wire"

import { decodeOverframeBuildString } from "./decode"
import { getOverframeItemsMap } from "./items-map"
import { extractOverframeData } from "./next-data"
import { mapOverframePolarity } from "./polarity"

/**
 * Parse an Overframe build URL into its numeric build id, or null if it isn't
 * one. Single source for both the host/shape validation and the id extraction
 * so the two can't drift (and the URL is only parsed once per call).
 */
export function parseOverframeBuildUrl(value: string): { id: string } | null {
  try {
    const url = new URL(value)
    if (url.hostname !== "overframe.gg" && url.hostname !== "www.overframe.gg")
      return null
    const m = url.pathname.match(/^\/build\/(\d+)(\/|$)/)
    return m ? { id: m[1] } : null
  } catch {
    return null
  }
}

type OverframeSlotLike = {
  slot_id?: unknown
  mod?: unknown
  rank?: unknown
  polarity?: unknown
}

function parseRawSlots(slots: unknown): OverframeRawSlot[] {
  if (!Array.isArray(slots)) return []
  const out: OverframeRawSlot[] = []
  for (const entry of slots as OverframeSlotLike[]) {
    const slot_id = Number(entry?.slot_id)
    const rank = Number(entry?.rank)
    const polarityCode = Number(entry?.polarity ?? 0)
    const modIdRaw = entry?.mod
    const modIdNum = typeof modIdRaw === "number" ? modIdRaw : Number(modIdRaw)
    const hasMod =
      modIdRaw !== null &&
      modIdRaw !== undefined &&
      Number.isFinite(modIdNum) &&
      modIdNum !== 0
    const overframeId = hasMod ? String(modIdRaw) : null
    if (!Number.isFinite(slot_id) || !Number.isFinite(rank)) continue
    const safePolarityCode = Number.isFinite(polarityCode) ? polarityCode : 0
    out.push({
      slot_id,
      overframeId,
      rank,
      polarityCode: safePolarityCode,
      polarity: mapOverframePolarity(safePolarityCode),
    })
  }
  return out
}

/**
 * Fetch-less import: build the scrape response from a `__NEXT_DATA__` object
 * the user copied off their own Overframe tab (via the bookmarklet), which
 * already cleared Overframe's Cloudflare challenge. `rawUrl` is best-effort — only kept when it's a real Overframe build URL.
 */
export function scrapeOverframeFromNextData(
  nextData: unknown,
  rawUrl?: string,
): OverframeScrapeResponse {
  const parsed = rawUrl ? parseOverframeBuildUrl(rawUrl) : null
  const url = parsed ? rawUrl! : ""
  const buildId = parsed?.id
  return assembleScrapeResponse(
    extractOverframeData(nextData, { url, buildId }),
    url,
    buildId,
  )
}

function assembleScrapeResponse(
  extracted: ReturnType<typeof extractOverframeData>,
  url: string,
  buildId: string | undefined,
): OverframeScrapeResponse {
  const warnings: OverframeImportWarning[] = []

  if (!extracted.nextData) {
    warnings.push({
      type: "next_data_missing",
      message: "Could not find __NEXT_DATA__ on the Overframe page.",
    })
  }

  let itemsMap: Map<string, string> | null = null
  try {
    itemsMap = getOverframeItemsMap()
  } catch (err) {
    warnings.push({
      type: "build_data_missing",
      message: "Overframe items map could not be loaded.",
      details: { error: err instanceof Error ? err.message : String(err) },
    })
  }

  let slots = parseRawSlots(extracted.slots)
  if (slots.length === 0 && extracted.buildString) {
    try {
      const decoded = decodeOverframeBuildString(extracted.buildString)
      slots = decoded.slots.map((s) => {
        // Map (slotType, slotIndex) back to a uniform slot_id via the shared,
        // bidirectional mapping. The buildstring fallback can't know the item
        // category yet (matching happens client-side), so it assumes the
        // warframe layout — the same assumption this code always made, now
        // single-sourced with the web interpreter via `encodeOverframeSlotId`.
        return {
          slot_id: encodeOverframeSlotId(s.slotType, s.slotIndex, "warframes"),
          overframeId: s.overframeId,
          rank: s.rank,
          polarityCode: 0,
        }
      })
      if (slots.length === 0) {
        warnings.push({
          type: "buildstring_decode_failed",
          message: "Decoded buildstring but couldn't interpret it as slots.",
        })
      }
    } catch (err) {
      warnings.push({
        type: "buildstring_decode_failed",
        message:
          err instanceof Error ? err.message : "Failed to decode buildstring",
      })
    }
  } else if (slots.length === 0) {
    warnings.push({
      type: "buildstring_missing",
      message: "No buildstring found in __NEXT_DATA__.",
    })
  }

  if (itemsMap) {
    for (const s of slots) {
      if (s.overframeId) {
        s.overframeName = itemsMap.get(s.overframeId)
      }
    }
  }

  return {
    source: {
      url,
      pageTitle: extracted.pageTitle,
      pageDescription: extracted.pageDescription,
      guideDescription: extracted.guideDescription,
      buildId,
      buildString: extracted.buildString,
    },
    itemName: extracted.itemName,
    formaCount:
      typeof extracted.formaCount === "number" ? extracted.formaCount : null,
    slots,
    helminthAbility: extracted.helminthAbility
      ? {
          slotIndex: extracted.helminthAbility.slotIndex,
          uniqueName: extracted.helminthAbility.uniqueName,
        }
      : undefined,
    warnings,
  }
}
