import { encodeOverframeSlotId } from "@arsenyx/shared/warframe/overframe-slots"
import type {
  OverframeImportWarning,
  OverframeRawSlot,
  OverframeScrapeResponse,
} from "@arsenyx/shared/warframe/overframe-wire"

import { SafeFetchError, safeFetch } from "../safe-fetch"
import { decodeOverframeBuildString } from "./decode"
import { getOverframeItemsMap } from "./items-map"
import { extractOverframeData, extractOverframeDataFromHtml } from "./next-data"
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

export function isValidOverframeBuildUrl(value: string): boolean {
  return parseOverframeBuildUrl(value) !== null
}

// Fetch wall-time / response-size / redirect caps. Without these a logged-in
// user (or a banned holder of an old PAT) could point this scrape at a page
// that streams forever, redirects to a private host, or returns gigabytes of
// HTML. `safeFetch` enforces the timeout + per-hop allowlist; the byte cap is
// re-applied while streaming the body below.
const FETCH_TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 1024 * 1024 // 1 MB — Next.js pages are large but bounded.
const MAX_REDIRECTS = 5

function safeFetchMessage(err: SafeFetchError): string {
  switch (err.code) {
    case "invalid_redirect":
      return "redirect off-host"
    case "too_many_redirects":
      return "too many redirects"
    case "upstream_status":
      return `HTTP ${err.status ?? "error"}`
    case "too_large":
      return "response too large"
    case "fetch_failed":
      return "request failed"
    case "private_host":
      return "host not allowed"
  }
}

async function fetchOverframeHtml(url: string): Promise<string> {
  let res: Response
  try {
    res = await safeFetch(url, {
      // Each redirect target gets the same gate as the caller's initial URL.
      isAllowed: (u) => isValidOverframeBuildUrl(u.href),
      maxBytes: MAX_HTML_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      blockPrivateDns: true,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ArsenyxBot/1.0; +https://arsenyx.com)",
        accept: "text/html,application/xhtml+xml",
      },
    })
  } catch (err) {
    if (err instanceof SafeFetchError) {
      // Overframe sits behind a Cloudflare managed challenge (Turnstile/JS
      // interstitial) that returns 403 to every non-browser client. No UA or
      // header tweak passes it — only a real browser can. Surface that plainly
      // instead of a bare "HTTP 403" so users don't think it's an Arsenyx bug.
      if (err.code === "upstream_status" && err.status === 403) {
        throw new Error(
          "Overframe is currently blocking automated imports (Cloudflare bot protection). This is on Overframe's side, not Arsenyx — please try again later.",
          { cause: err },
        )
      }
      throw new Error(`Overframe fetch failed: ${safeFetchMessage(err)}`, {
        cause: err,
      })
    }
    throw err
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

export async function scrapeOverframeBuild(
  url: string,
): Promise<OverframeScrapeResponse> {
  const parsed = parseOverframeBuildUrl(url)
  if (!parsed) {
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

  const buildId = parsed.id
  return assembleScrapeResponse(
    extractOverframeDataFromHtml(html, { url, buildId }),
    url,
    buildId,
  )
}

/**
 * Fetch-less import: build the scrape response from a `__NEXT_DATA__` object
 * the user copied off their own Overframe tab (via the bookmarklet). Their
 * browser already cleared Cloudflare's challenge, so this sidesteps the 403
 * that blocks the server-side {@link scrapeOverframeBuild} path. `rawUrl` is
 * best-effort — only kept when it's a real Overframe build URL.
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
