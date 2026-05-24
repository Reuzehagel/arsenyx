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

// Mirror of the hardening in routes/img.ts: cap fetch wall-time, cap response
// size, follow redirects manually so a 3xx chain can't escape overframe.gg.
// Without these, a logged-in user (or a banned holder of an old PAT) could
// point this scrape at a page that streams forever, redirects to a private
// host, or returns gigabytes of HTML.
const FETCH_TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 1024 * 1024 // 1 MB — Next.js pages are large but bounded.
const MAX_REDIRECTS = 5

async function fetchOverframeOnce(url: string): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      // Manual so we can re-validate every Location against
      // isValidOverframeBuildUrl. A `redirect: "follow"` here would let
      // Overframe (or anyone they 302 to) reach an arbitrary host on our
      // behalf — same threat the image proxy guards against.
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ArsenyxBot/1.0; +https://arsenyx.com)",
        accept: "text/html,application/xhtml+xml",
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchOverframeHtml(url: string): Promise<string> {
  // Caller already validated `url` via isValidOverframeBuildUrl; each
  // redirect target gets the same gate below.
  let current = url
  let res = await fetchOverframeOnce(current)

  let hops = 0
  while (res.status >= 300 && res.status < 400 && hops < MAX_REDIRECTS) {
    const loc = res.headers.get("location")
    let nextUrl: string
    try {
      nextUrl = new URL(loc ?? "", current).toString()
    } catch {
      throw new Error("Overframe fetch failed: bad redirect target")
    }
    if (!isValidOverframeBuildUrl(nextUrl)) {
      throw new Error("Overframe fetch failed: redirect off-host")
    }
    hops += 1
    current = nextUrl
    res = await fetchOverframeOnce(current)
  }

  if (res.status >= 300 && res.status < 400) {
    throw new Error("Overframe fetch failed: too many redirects")
  }
  if (!res.ok) {
    throw new Error(`Overframe fetch failed: ${res.status} ${res.statusText}`)
  }

  const declared = res.headers.get("content-length")
  if (declared) {
    const n = parseInt(declared, 10)
    if (Number.isFinite(n) && n > MAX_HTML_BYTES) {
      throw new Error("Overframe fetch failed: response too large")
    }
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error("Overframe fetch failed: empty body")
  }

  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_HTML_BYTES) {
        void reader.cancel()
        throw new Error("Overframe fetch failed: response too large")
      }
      chunks.push(value)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // Already released on cancel.
    }
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder("utf-8").decode(merged)
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
        // TODO: warframe-shaped only — companion/necramech buildstring fallbacks
        // will emit wrong slot_ids here. Mirror of the decoder in
        // apps/web/src/lib/overframe/index.ts `interpretSlot`; share once a
        // second case forces the abstraction. Related: #57.
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
