/**
 * Phase 5 of the catalog build: resolve a `uniqueName → image URL` lookup for
 * every entity (items, mods, arcanes, helminth abilities), plus the
 * arcane-specific maps the mod/arcane merge needs.
 *
 * Primary source: DE PublicExport CDN (covers ~99% of items). Fallback: the
 * wiki MediaWiki API for the handful DE doesn't manifest (beast claws, railjack
 * ordnance, modular pieces, exalted-stance cards), resolved once and cached to
 * disk so subsequent builds run offline. See ./images for the resolvers.
 */

import { ARCANE_INTERNALNAME_FIXES } from "../../data/curated/arcane-internalname-fixes"
import {
  buildDeImageLookup,
  iterWikiImageEntries,
  iterWikiRecords,
  readWikiImageCache,
  resolveWikiImageUrls,
  writeWikiImageCache,
} from "./images"
import type { DeManifestEntry } from "./read-de"

/**
 * Synthetic uniqueName for an exalted-stance card image (Serene Storm, Primal
 * Fury, …). DE doesn't export these locked stances as catalog mods, so they're
 * registered under this key so they flow through the same resolve + sync:images
 * path as every other wiki image. Keyed by filename so variants sharing one
 * card (Exalted Blade / Umbra / Prime) resolve once.
 */
export function exaltedStanceImageKey(file: string): string {
  return `arsenyx://exalted-stance-image/${file}`
}

export interface ResolvedImages {
  /** Final lookup: DE URL if present, else wiki URL via cache. */
  imageByUniqueName: Map<string, string>
  /** Arcane uniqueName → wiki full-art frame URL (DE only ships the small
   *  "Projection" symbol PNG; the wiki ships the art players know). Absent
   *  when no wiki art resolved — callers fall back to imageByUniqueName. */
  arcaneArtUrlByUniqueName: Map<string, string>
  /** Arcane uniqueName → wiki `Type` field (the authoritative equip slot). */
  arcaneSlotByUniqueName: Map<string, string>
  /** Canonical in-game arcane set (records carrying an Image) — used to drop
   *  DE's per-ability-slot dupes and cut entries. */
  wikiArcaneNames: Set<string>
}

export async function resolveImages(opts: {
  deManifest: DeManifestEntry[]
  wikiFramesBlob: unknown
  wikiCompanionsBlob: unknown
  wikiWeaponsByName: Map<string, Record<string, unknown>>
  wikiModsBlob: unknown
  wikiArcanesBlob: unknown
  /** curated.exaltedStances — only `wikiImage` is read here. */
  exaltedStances: Record<string, { wikiImage: string }>
  /** Path to data/curated/wiki-image-urls.json. */
  cachePath: string
}): Promise<ResolvedImages> {
  const {
    deManifest,
    wikiFramesBlob,
    wikiCompanionsBlob,
    wikiWeaponsByName,
    wikiModsBlob,
    wikiArcanesBlob,
    exaltedStances,
    cachePath,
  } = opts

  // Primary source: DE PublicExport CDN (content.warframe.com), via the
  // textureLocation field on each ExportManifest entry. Covers everything
  // DE ships (~99% of items, including mods + arcanes).
  const deImageUrls = buildDeImageLookup(deManifest)

  // Fallback source: wiki MediaWiki API, for the small set of items DE
  // doesn't manifest but the wiki documents with an `Image` field (beast
  // claws, railjack ordnance, modular pieces, a handful of mods). Build a
  // `uniqueName → wiki Image filename` map by walking the loaded wiki modules.
  const wikiImageFileByUniqueName = new Map<string, string>()
  const allWikiModules: unknown[] = [
    wikiFramesBlob,
    wikiCompanionsBlob,
    ...[...wikiWeaponsByName.values()],
    wikiModsBlob,
    wikiArcanesBlob,
  ]
  for (const mod of allWikiModules) {
    for (const { internalName, image } of iterWikiImageEntries(mod)) {
      // First write wins; conflicts are wiki-side data issues. Skip
      // any uniqueName DE already covers — DE CDN is faster + more stable.
      if (deImageUrls.has(internalName)) continue
      if (!wikiImageFileByUniqueName.has(internalName)) {
        wikiImageFileByUniqueName.set(internalName, image)
      }
    }
  }

  // Exalted-stance card images. Register under synthetic uniqueNames so they
  // route through the same resolve + sync:images path as every other image.
  for (const { wikiImage } of Object.values(exaltedStances)) {
    const key = exaltedStanceImageKey(wikiImage)
    if (!wikiImageFileByUniqueName.has(key)) {
      wikiImageFileByUniqueName.set(key, wikiImage)
    }
  }

  // Walk the wiki Arcane module once, building everything keyed off arcane
  // records together: full-art filename, the canonical in-game name set, and
  // the equip-slot `Type` field.
  const arcaneWikiImageFile = new Map<string, string>()
  const wikiArcaneNames = new Set<string>()
  const arcaneSlotByUniqueName = new Map<string, string>()
  for (const { internalName, record } of iterWikiRecords(wikiArcanesBlob)) {
    // The wiki module sometimes mislabels a row's InternalName with a
    // neighbour's uniqueName (a shifted column), landing the art on the wrong
    // arcane. Correct the join key by the stable `Name` field — see
    // data/curated/arcane-internalname-fixes.ts.
    const name = record["Name"]
    const un =
      (typeof name === "string" && ARCANE_INTERNALNAME_FIXES[name]) ||
      internalName
    const image = record["Image"]
    if (typeof image === "string" && image.length > 0) {
      arcaneWikiImageFile.set(un, image)
      wikiArcaneNames.add(un)
    }
    const t = record["Type"]
    if (typeof t === "string" && t.length > 0) {
      arcaneSlotByUniqueName.set(un, t)
    }
  }

  const wikiCache = readWikiImageCache(cachePath)
  const neededFilenames = new Set<string>()
  for (const fn of wikiImageFileByUniqueName.values()) {
    if (!wikiCache.urls[fn]) neededFilenames.add(fn)
  }
  // Arcane wiki images override DE projections; resolve those too even when
  // DE already covers them.
  for (const fn of arcaneWikiImageFile.values()) {
    if (!wikiCache.urls[fn]) neededFilenames.add(fn)
  }
  if (neededFilenames.size > 0) {
    console.log(
      `Resolving ${neededFilenames.size} wiki image URLs via MediaWiki API...`,
    )
    const resolved = await resolveWikiImageUrls(neededFilenames)
    for (const [fn, url] of resolved) wikiCache.urls[fn] = url
    writeWikiImageCache(cachePath, wikiCache)
    console.log(`  OK  resolved ${resolved.size} / ${neededFilenames.size}`)
  }

  const imageByUniqueName = new Map<string, string>()
  for (const [un, url] of deImageUrls) imageByUniqueName.set(un, url)
  for (const [un, fn] of wikiImageFileByUniqueName) {
    const url = wikiCache.urls[fn]
    if (url) imageByUniqueName.set(un, url)
  }

  // Pre-resolve arcane full-art URLs so callers don't need the raw cache.
  const arcaneArtUrlByUniqueName = new Map<string, string>()
  for (const [un, fn] of arcaneWikiImageFile) {
    const url = wikiCache.urls[fn]
    if (url) arcaneArtUrlByUniqueName.set(un, url)
  }

  return {
    imageByUniqueName,
    arcaneArtUrlByUniqueName,
    arcaneSlotByUniqueName,
    wikiArcaneNames,
  }
}
