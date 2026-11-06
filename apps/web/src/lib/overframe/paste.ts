// The paste-based Overframe import (/import): the bookmarklet that copies an
// Overframe page's __NEXT_DATA__, parsing that clipboard payload, posting it to
// the API, and the debug summary of the result.

import type { OverframeScrapeResponse } from "@arsenyx/shared/warframe/overframe-wire"
import type { BrowseCategory, BrowseItem } from "@arsenyx/shared/warframe/types"

import { computeFormaCount } from "@/lib/build/forma-count"
import { getInnatePolarities } from "@/lib/build/polarities"
import type { DetailItem } from "@/lib/catalog"
import { apiCall } from "@/lib/util/api-client"

import type { ApplyResult } from "./index"

/** Tags the clipboard payload; shared by the bookmarklet that writes it and
 *  the parser that reads it back. */
const OVERFRAME_PASTE_SOURCE = "arsenyx-overframe"

type PastedOverframe = {
  source?: string
  url?: string
  nextData?: unknown
}

/**
 * Interpret pasted clipboard text. The bookmarklet wraps the page's
 * __NEXT_DATA__ as `{ source: "arsenyx-overframe", url, nextData }`; a bare
 * __NEXT_DATA__ blob copied by hand is accepted too.
 */
export function parsePastedOverframe(text: string): {
  nextData: unknown
  url?: string
} {
  const obj = JSON.parse(text.trim()) as PastedOverframe
  // A non-object is never a valid __NEXT_DATA__ blob — reject it here so the
  // caller surfaces the friendly message instead of a bare 400.
  if (!obj || typeof obj !== "object") {
    throw new Error("Pasted data is not an object")
  }
  if (obj.source === OVERFRAME_PASTE_SOURCE) {
    return {
      nextData: obj.nextData,
      url: typeof obj.url === "string" ? obj.url : undefined,
    }
  }
  return { nextData: obj }
}

/** Parse pasted text and have the API scrape it; errors are user-facing. */
export async function importPastedOverframe(
  text: string,
): Promise<OverframeScrapeResponse> {
  let input: { nextData: unknown; url?: string }
  try {
    input = parsePastedOverframe(text)
  } catch {
    throw new Error(
      "That doesn't look like Overframe build data. Use the bookmarklet on an Overframe build page, then paste here.",
    )
  }
  return apiCall<OverframeScrapeResponse>(`/imports/overframe/raw`, {
    method: "POST",
    json: input,
    serverMessage: true,
    codes: { default: "Import failed" },
  })
}

/**
 * The bookmarklet: reads __NEXT_DATA__ off the (already challenge-cleared)
 * Overframe tab, copies it to the clipboard, and opens our import page with
 * `?paste=1`. Built from the live origin so the dev build points at itself.
 */
export function buildBookmarklet(origin: string): string {
  return `javascript:(function(){try{var e=document.getElementById('__NEXT_DATA__');if(!e){alert('Arsenyx: open an Overframe build page first — no build data found here.');return;}var p=JSON.stringify({source:${JSON.stringify(OVERFRAME_PASTE_SOURCE)},url:location.href,nextData:JSON.parse(e.textContent)});navigator.clipboard.writeText(p).then(function(){window.open(${JSON.stringify(`${origin}/import?paste=1`)},'_blank');},function(){alert('Arsenyx: the browser blocked clipboard access. Try clicking the bookmark again.');});}catch(x){alert('Arsenyx import failed: '+(x&&x.message?x.message:x));}})();`
}

/**
 * Compact payload for the "Copy debug JSON" button. The raw scrape/applied
 * dump is huge (every mod's full `levelStats`) and hides what matters when an
 * import looks wrong; this keeps the item's innate polarities, computed vs
 * Overframe forma counts, and the per-slot trace (`applied.trace`) showing
 * where every Overframe slot landed and the matched mod's `type`.
 */
export function buildImportDebug(
  result: OverframeScrapeResponse,
  applied: ApplyResult,
  matchedItem: { item: BrowseItem; category: BrowseCategory },
  detailItem: DetailItem,
) {
  const { category } = matchedItem
  const formIndex = applied.data.formIndex ?? 0
  const innates = getInnatePolarities(detailItem, category, formIndex)

  return {
    url: result.source.url,
    buildId: result.source.buildId,
    buildString: result.source.buildString,
    item: {
      name: matchedItem.item.name,
      slug: matchedItem.item.slug,
      category,
      displayClass: matchedItem.item.displayClass,
    },
    innates: {
      aura: innates.aura.map((p) => p ?? null),
      exilus: innates.exilus ?? null,
      stance: innates.stance ?? null,
      normals: innates.normal.map((p) => p ?? null),
    },
    forma: {
      computed: computeFormaCount(
        detailItem,
        category,
        applied.data.formaPolarities ?? {},
        formIndex,
      ),
      ofReported: result.formaCount,
    },
    formaPolarities: applied.data.formaPolarities ?? {},
    slots: applied.trace,
    arcanes: (applied.data.arcanes ?? [])
      .map((a, i) =>
        a ? { index: i, name: a.arcane.name, rank: a.rank } : null,
      )
      .filter(Boolean),
    helminth: applied.data.helminth
      ? Object.entries(applied.data.helminth).map(([slot, ab]) => ({
          slot: Number(slot),
          name: ab.name,
        }))
      : null,
    guideChars: applied.guideDescription?.length ?? 0,
    warnings: { scrape: result.warnings, apply: applied.warnings },
  }
}
