import { decodeOverframeBuildString } from "./decode"
import { getOverframeItemsMap } from "./items-map"
import { extractOverframeDataFromHtml } from "./next-data"
import { mapOverframePolarityCode } from "./polarity"
import type { OverframeImportWarning } from "./types"

export function isValidOverframeBuildUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.hostname !== "overframe.gg" && url.hostname !== "www.overframe.gg")
      return false
    return /^\/build\/(\d+)(\/|$)/.test(url.pathname)
  } catch {
    return false
  }
}

async function fetchOverframeHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; ArsenyxBot/1.0; +https://arsenyx.com)",
      accept: "text/html,application/xhtml+xml",
    },
  })
  if (!res.ok) {
    throw new Error(`Overframe fetch failed: ${res.status} ${res.statusText}`)
  }
  return res.text()
}

type OverframeSlotLike = {
  slot_id?: unknown
  mod?: unknown
  rank?: unknown
  polarity?: unknown
}

/**
 * Raw slot entry as emitted by Overframe. The client interprets slot_id
 * (1-8 = normal, 9/10 = aura/exilus or exilus/arcane depending on category,
 * 11+ = arcane) once it knows the matched item's category.
 */
export interface OverframeRawSlot {
  slot_id: number
  overframeId: string | null
  overframeName?: string
  rank: number
  polarityCode: number
  /** Mapped Polarity string when code is known, else undefined. */
  polarity?: string
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
    const mapped = mapOverframePolarityCode(
      Number.isFinite(polarityCode) ? polarityCode : 0,
    )
    out.push({
      slot_id,
      overframeId,
      rank,
      polarityCode: Number.isFinite(polarityCode) ? polarityCode : 0,
      polarity: mapped.polarity,
    })
  }
  return out
}

/**
 * Raw scrape response. Client is responsible for matching item/mods/arcanes
 * against WFCD data and interpreting slot_id layout.
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

export async function scrapeOverframeBuild(
  url: string,
): Promise<OverframeScrapeResponse> {
  const warnings: OverframeImportWarning[] = []

  if (!isValidOverframeBuildUrl(url)) {
    return {
      source: { url },
      formaCount: null,
      slots: [],
      warnings: [
        {
          type: "invalid_url",
          message: "URL must look like https://overframe.gg/build/<id>/...",
        },
      ],
    }
  }

  let html: string
  try {
    html = await fetchOverframeHtml(url)
  } catch (err) {
    return {
      source: { url },
      formaCount: null,
      slots: [],
      warnings: [
        {
          type: "fetch_failed",
          message:
            err instanceof Error
              ? err.message
              : "Failed to fetch Overframe page",
        },
      ],
    }
  }

  const buildId = (() => {
    try {
      const u = new URL(url)
      const m = u.pathname.match(/^\/build\/(\d+)/)
      return m?.[1]
    } catch {
      return undefined
    }
  })()

  const extracted = extractOverframeDataFromHtml(html, { url, buildId })
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
        // Map (slotType, slotIndex) back to slot_id for a uniform shape.
        const slot_id =
          s.slotType === "normal"
            ? 8 - s.slotIndex
            : s.slotType === "aura"
              ? 9
              : s.slotType === "exilus"
                ? 10
                : 11 + s.slotIndex
        return {
          slot_id,
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
