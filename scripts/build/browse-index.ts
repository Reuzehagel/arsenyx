/**
 * Phase 7 of the catalog build: fold every merged entity (frames, weapons,
 * companions, the synthetic Plexus) into the per-category `byCategory` browse
 * listing, and collect the weapon detail map keyed by `${category}|${slug}`.
 */

import { slugify } from "@arsenyx/shared/warframe/slugs"
import type { BrowseItem } from "@arsenyx/shared/warframe/types"

import {
  buildExaltedSet,
  categorizeCompanion,
  categorizeFrame,
  categorizeWeapon,
  frameDisplayClass,
  isExaltedWeapon,
  type BrowseCategory,
} from "./categorize"
import type { MergedCompanion } from "./merge-companions"
import type { MergedFrame } from "./merge-frames"
import type { MergedWeapon } from "./merge-weapons"
import type { CuratedData } from "./read-curated"

/** Just the running counters this phase increments. */
interface BrowseStats {
  frames: { emitted: number }
  weapons: { emitted: number }
  perCategory: Record<string, number>
}

export interface BrowseIndex {
  byCategory: Partial<Record<BrowseCategory, BrowseItem[]>>
  /** `${category}|${slug}` → weapon, for the per-item detail emit. */
  weaponDetailByCatAndSlug: Map<string, MergedWeapon>
  /** Release-history display names that matched an item, for dead-entry warns. */
  releaseHistoryResolved: Set<string>
}

export function buildBrowseIndex(opts: {
  mergedFrames: MergedFrame[]
  operators: MergedFrame[]
  mergedWeapons: MergedWeapon[]
  mergedCompanions: MergedCompanion[]
  curated: Pick<CuratedData, "releaseHistory" | "plexusBrowse">
  imageByUniqueName: Map<string, string>
  stats: BrowseStats
}): BrowseIndex {
  const {
    mergedFrames,
    operators,
    mergedWeapons,
    mergedCompanions,
    curated,
    imageByUniqueName,
    stats,
  } = opts

  const byCategory: Partial<Record<BrowseCategory, BrowseItem[]>> = {}
  function push(cat: BrowseCategory, item: BrowseItem): void {
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat]!.push(item)
  }

  // Release-history enrichment is keyed by display name. Track resolved
  // names so we can warn about dead curated entries.
  const releaseHistoryResolved = new Set<string>()
  function applyReleaseHistory(name: string, item: BrowseItem): void {
    const rec = curated.releaseHistory[name]
    if (!rec) return
    releaseHistoryResolved.add(name)
    if (rec.releaseDate) item.releaseDate = rec.releaseDate
    if (rec.vaulted) item.vaulted = true
  }

  // Frames
  for (const f of [...mergedFrames, ...operators]) {
    const cat = categorizeFrame(f)
    if (!cat) continue
    const browseItem: BrowseItem = {
      uniqueName: f.uniqueName,
      name: f.name,
      slug: slugify(f.name),
      category: cat,
      imageName: imageByUniqueName.get(f.uniqueName),
      masteryReq: f.masteryReq,
      isPrime: f.isPrime,
      displayClass: frameDisplayClass(f),
    }
    applyReleaseHistory(f.name, browseItem)
    push(cat, browseItem)
    stats.frames.emitted++
  }

  // Weapons — pre-compute the exalted set from frames' exalted[] arrays
  // so categorize picks up exalteds the wiki doesn't tag (Garuda Talons).
  const exaltedSet = buildExaltedSet(mergedFrames)
  const weaponDetailByCatAndSlug = new Map<string, MergedWeapon>()
  // DE ships internal clones that share a display name (and thus slug) with a
  // real weapon but carry a distinct uniqueName, so the uniqueName dedup above
  // doesn't catch them — e.g. `TnDoppelgangerGrimoire` collides with the real
  // `TnGrimoire`. Without a guard the clone emits a duplicate browse card and
  // overwrites the real weapon's `${cat}|${slug}` detail entry. Key the guard
  // on `${category}|${slug}` (the same unit the detail map and browse cards
  // use) so two genuinely distinct weapons that happen to slugify alike in
  // *different* categories both survive. First-wins: the real weapon precedes
  // its clone in DE's export, so keep the first.
  const seenWeaponSlugs = new Set<string>()
  for (const w of mergedWeapons) {
    const cats = categorizeWeapon(w, exaltedSet)
    if (cats.length === 0) continue
    const slug = slugify(w.name)
    const slugKey = `${cats[0]!}|${slug}`
    if (seenWeaponSlugs.has(slugKey)) continue
    seenWeaponSlugs.add(slugKey)
    const browseItem: BrowseItem = {
      uniqueName: w.uniqueName,
      name: w.name,
      slug,
      category: cats[0]!,
      imageName: imageByUniqueName.get(w.uniqueName),
      masteryReq: w.masteryReq,
      isPrime: w.name.includes(" Prime"),
      displayClass: w.displayClass ?? undefined,
    }
    applyReleaseHistory(w.name, browseItem)
    const exalted = isExaltedWeapon(w, exaltedSet)
    for (const c of cats) {
      // Emit the detail file for every category so links resolve regardless
      // of which path reaches the weapon.
      weaponDetailByCatAndSlug.set(`${c}|${slug}`, w)
      // Exalted weapons have their own "Exalted Weapons" tab; don't also list
      // them in the generic weapon tabs (melee/primary/secondary) where they
      // cluttered the list and double-rendered in the All view.
      if (exalted && c !== "exalted-weapons") continue
      push(c, { ...browseItem, category: c })
    }
    stats.weapons.emitted++
  }

  // Companions
  for (const c of mergedCompanions) {
    const cat = categorizeCompanion(c)
    const browseItem: BrowseItem = {
      uniqueName: c.uniqueName,
      name: c.name,
      slug: slugify(c.name),
      category: cat,
      imageName: imageByUniqueName.get(c.uniqueName),
      masteryReq: c.masteryReq,
      isPrime: c.isPrime,
      displayClass: c.subType === "sentinel" ? "Sentinel" : "Beast Companion",
    }
    applyReleaseHistory(c.name, browseItem)
    push(cat, browseItem)
  }

  // Synthetic Plexus — the only browseable Railjack item. Turrets,
  // ordnance, and reactors stay in the catalog but are sidebar pickers
  // inside the Plexus editor (see scripts/build/categorize.ts).
  push("railjack", {
    uniqueName: curated.plexusBrowse.uniqueName,
    name: curated.plexusBrowse.name,
    slug: curated.plexusBrowse.slug,
    category: "railjack",
    imageName: curated.plexusBrowse.imageName,
    isPrime: false,
    displayClass: "Plexus",
  })

  // Per-category counts
  for (const [cat, arr] of Object.entries(byCategory)) {
    stats.perCategory[cat] = arr?.length ?? 0
  }

  return { byCategory, weaponDetailByCatAndSlug, releaseHistoryResolved }
}
