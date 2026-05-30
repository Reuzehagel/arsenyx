/**
 * Image URL lookups for items, mods, and arcanes.
 *
 * Two sources, both official and CORS-open with year-long cache:
 *
 *   1. **DE PublicExport CDN** — `content.warframe.com/PublicExport/<path>`,
 *      where `<path>` is the `textureLocation` field on the matching
 *      `ExportManifest.json` entry. Covers ~99% of items DE ships
 *      (weapons, frames, companions, mods, arcanes).
 *
 *   2. **Wiki MediaWiki API** — `wiki.warframe.com/api.php?action=query
 *      &prop=imageinfo&iiprop=url&titles=File:...`. Used for the small
 *      set of items DE doesn't manifest (beast claws, railjack ordnance,
 *      modular pieces) but the wiki documents with an `Image` field.
 *      Resolved at build time and cached in
 *      `data/curated/wiki-image-urls.json` so subsequent builds are
 *      offline.
 *
 * Both sources are content-hashed, so once resolved the URLs are stable
 * for the file's lifetime. Cache invalidation = re-running the resolve
 * step after a wiki re-upload or DE export bump.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

import { fetchRetry } from "./http"
import type { DeManifestEntry } from "./read-de"

const DE_CDN_BASE = "https://content.warframe.com/PublicExport"

/** Build `uniqueName → DE CDN URL` map from the manifest. The
 *  `textureLocation` already includes the `!00_<hash>` cache-busting
 *  suffix; we keep it because the CDN keys on the full path. */
export function buildDeImageLookup(
  manifest: DeManifestEntry[],
): Map<string, string> {
  const out = new Map<string, string>()
  for (const ent of manifest) {
    const loc = ent.textureLocation
    if (typeof loc !== "string" || loc.length === 0) continue
    // The manifest occasionally ships Windows-style backslashes; normalize.
    const path = loc.replace(/\\/g, "/")
    out.set(ent.uniqueName, `${DE_CDN_BASE}${path.startsWith("/") ? "" : "/"}${path}`)
  }
  return out
}

// ---------------------------------------------------------------------------
// MediaWiki API resolver (for the wiki-only fallback set).
// ---------------------------------------------------------------------------

const WIKI_API = "https://wiki.warframe.com/api.php"
/** MediaWiki caps query batches at 50 titles. */
const BATCH_SIZE = 50

interface MediaWikiQueryResponse {
  query?: {
    // MediaWiki canonicalizes titles (capitalizes the first letter, spaces →
    // underscores) and reports the mapping here. We must map results back to
    // the caller's original filename or normalized titles silently miss.
    normalized?: Array<{ from?: string; to?: string }>
    pages?: Record<
      string,
      {
        title?: string
        imageinfo?: Array<{ url?: string }>
      }
    >
  }
}

/** Resolve wiki Image filenames (e.g. `"BeastClaws.png"`) to canonical
 *  `wiki.warframe.com/images/<resolved>?<ver>` URLs in batches. Caller
 *  passes a set of bare filenames; the returned map keys on those same
 *  filenames. Missing entries silently drop. */
export async function resolveWikiImageUrls(
  imageFilenames: Iterable<string>,
): Promise<Map<string, string>> {
  const unique = [...new Set(imageFilenames)].filter((n) => n.length > 0)
  const out = new Map<string, string>()
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    const titles = batch.map((n) => `File:${n}`).join("|")
    const url =
      `${WIKI_API}?action=query&prop=imageinfo&iiprop=url&format=json` +
      `&titles=${encodeURIComponent(titles)}`
    // Through fetchRetry: this runs inside a watchdog'd data:bump step, so a
    // half-open stall must retry/abort rather than hang until SIGKILL.
    const res = await fetchRetry(url, {
      headers: { "User-Agent": "arsenyx-image-sync (https://www.arsenyx.com)" },
    })
    if (!res.ok) {
      throw new Error(
        `MediaWiki API HTTP ${res.status} on batch ${i / BATCH_SIZE + 1}: ${res.statusText}`,
      )
    }
    const json = (await res.json()) as MediaWikiQueryResponse
    // Map each canonical `File:<to>` title back to the bare filename(s) the
    // caller asked for, so a non-canonical Image field still resolves.
    const canonicalToRequested = new Map<string, string>()
    for (const { from, to } of json.query?.normalized ?? []) {
      if (from && to) {
        canonicalToRequested.set(to.replace(/^File:/, ""), from.replace(/^File:/, ""))
      }
    }
    const pages = json.query?.pages ?? {}
    for (const page of Object.values(pages)) {
      const title = page.title?.replace(/^File:/, "")
      const u = page.imageinfo?.[0]?.url
      if (!title || !u) continue
      out.set(title, u)
      const requested = canonicalToRequested.get(title)
      if (requested) out.set(requested, u)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Cached wiki-image resolution.
// ---------------------------------------------------------------------------

interface WikiImageCache {
  // Map from wiki Image filename → resolved direct URL.
  urls: Record<string, string>
}

export function readWikiImageCache(path: string): WikiImageCache {
  if (!existsSync(path)) return { urls: {} }
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw) as WikiImageCache
}

export function writeWikiImageCache(path: string, cache: WikiImageCache): void {
  mkdirSync(dirname(path), { recursive: true })
  // Sort keys for deterministic diffs.
  const sorted: Record<string, string> = {}
  for (const k of Object.keys(cache.urls).sort()) sorted[k] = cache.urls[k]!
  writeFileSync(path, JSON.stringify({ urls: sorted }, null, 2), "utf8")
}

// ---------------------------------------------------------------------------
// Wiki-module walker: pulls (InternalName, Image) pairs out of wiki Lua
// module data. Tables are nested arbitrarily (Mods_data has a top-level
// `DefaultUpgrades` subtable; Warframes_data has Warframes / Archwings /
// Necramechs / Operators; per-slot Weapons_data_* are flat).
// ---------------------------------------------------------------------------

export function* iterWikiImageEntries(
  obj: unknown,
): Generator<{ internalName: string; image: string }> {
  if (!obj || typeof obj !== "object") return
  const rec = obj as Record<string, unknown>
  const internalName = rec["InternalName"]
  const image = rec["Image"]
  if (
    typeof internalName === "string" &&
    internalName.length > 0 &&
    typeof image === "string" &&
    image.length > 0
  ) {
    yield { internalName, image }
    // Don't recurse: a record that has InternalName is itself an item.
    return
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") yield* iterWikiImageEntries(v)
  }
}

/**
 * Walk a wiki module blob and yield every record that has an InternalName.
 * The whole record is yielded so callers can pluck arbitrary fields
 * (IsExilus, Polarity, etc.) without re-walking. */
export function* iterWikiRecords(
  obj: unknown,
): Generator<{ internalName: string; record: Record<string, unknown> }> {
  if (!obj || typeof obj !== "object") return
  const rec = obj as Record<string, unknown>
  const internalName = rec["InternalName"]
  if (typeof internalName === "string" && internalName.length > 0) {
    yield { internalName, record: rec }
    return
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") yield* iterWikiRecords(v)
  }
}

