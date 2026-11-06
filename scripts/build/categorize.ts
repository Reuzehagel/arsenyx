/**
 * Route merged frame / weapon records into the BrowseCategory buckets the web
 * app consumes (companions all land in "companions").
 */

import type { BrowseCategory } from "@arsenyx/shared/warframe/types"

import { NON_BUILDABLE_FRAMES } from "../../data/curated/frames"
import type { MergedFrame } from "./merge-frames"
import type { MergedWeapon } from "./merge-weapons"
import { ATMOSPHERE_SLOT } from "./names"

/** Routing for a weapon the wiki doesn't document yet, by DE productCategory:
 *  its browse category, and the generic per-slot mod pool that keeps it
 *  MODDABLE until the wiki catches up (merge-weapons.ts; applied only to
 *  weapons with a riven disposition). `SentinelWeapons` has no pool: which
 *  generic pool sentinel weapons accept is a game-mechanic fact we won't guess
 *  — add it (verified) the day a wikiless sentinel weapon ships. */
export const WIKILESS_PRODUCT_CATEGORIES: Readonly<
  Record<string, { category: BrowseCategory; pool?: string }>
> = {
  LongGuns: { category: "primary", pool: "Rifle" },
  Pistols: { category: "secondary", pool: "Pistol" },
  Melee: { category: "melee", pool: "Melee" },
  SentinelWeapons: { category: "companion-weapons" },
  SpaceGuns: { category: "archwing", pool: "Archgun" },
  SpaceMelee: { category: "archwing", pool: "Archmelee" },
}

/** Build the set of weapon uniqueNames that are exalted, by union'ing every
 *  warframe + necramech's `exalted` array. The wiki sometimes classifies
 *  exalteds as their melee Class (e.g. Garuda Talons Class="Claws") rather
 *  than "Exalted Weapon", so this cross-reference is more reliable. */
export function buildExaltedSet(frames: readonly MergedFrame[]): Set<string> {
  const out = new Set<string>()
  for (const f of frames) {
    for (const u of f.exalted) out.add(u)
  }
  return out
}

/** Map MergedFrame.category → BrowseCategory (null: not a buildable frame). */
export function categorizeFrame(f: MergedFrame): BrowseCategory | null {
  if (NON_BUILDABLE_FRAMES.has(f.name)) return null
  return f.category
}

/** The wiki "Class" label surfaced on a frame's browse card. */
export function frameDisplayClass(f: MergedFrame): string {
  switch (f.category) {
    case "warframes":
      return "Warframe"
    case "necramechs":
      return "Necramech"
    case "archwing":
      return "Archwing"
    case "operators":
      return "Operator"
  }
}

/** A weapon is exalted if the wiki tags it "Exalted Weapon", OR a warframe/
 *  necramech lists it in its `exalted` array (the wiki sometimes labels them
 *  by melee Class instead, e.g. Garuda's Talons = "Claws") AND it's a summoned
 *  `SpecialItems` weapon rather than standalone gear. The productCategory check
 *  is what keeps Mausolon out: Necramechs list their *standard* equipped
 *  arch-gun (Mausolon, a normal `SpaceGuns` Archgun) in `exalted` alongside
 *  their real exalted weapon, but it's independently built, not summoned. */
export function isExaltedWeapon(
  w: MergedWeapon,
  exaltedSet: Set<string>,
): boolean {
  if (w.displayClass === "Exalted Weapon") return true
  if (!exaltedSet.has(w.uniqueName)) return false
  return w.productCategory === "SpecialItems"
}

/** Route a merged weapon to its BrowseCategory.
 *  Returns multiple categories when the item belongs to several (e.g. an
 *  Exalted Weapon is also a primary/secondary/melee for mod-pool purposes).
 *
 *  Rule of thumb: route ONLY when we have a wiki record (Slot or Class).
 *  Falling back to DE `productCategory` alone sweeps in modular parts,
 *  ingredients (ANTIGEN/MUTAGEN), MK1 starter duplicates, and other
 *  non-playable rows from the `SpecialItems`/`Pistols` blobs.
 */
export function categorizeWeapon(
  w: MergedWeapon,
  exaltedSet: Set<string>,
): readonly BrowseCategory[] {
  if (w.name.includes(" Blueprint")) return []
  if (w.productCategory === "OperatorAmps") return []

  const out: BrowseCategory[] = []
  const isExalted = isExaltedWeapon(w, exaltedSet)

  // Slot from wiki is the authoritative routing signal — present on every
  // playable weapon. Items without a wiki Slot (or with a Slot we don't
  // map, like "Amp") are typically modular parts/ingredients and we drop
  // them.
  switch (w.slot) {
    // Player-equipped weapons
    case "Primary":
      out.push("primary")
      break
    case "Secondary":
      out.push("secondary")
      break
    case "Melee":
      out.push("melee")
      break
    // Archwing (Archguns + Archmelees + atmospheric Archgun deployment)
    case "Archgun":
    case ATMOSPHERE_SLOT:
    case "Archmelee":
      out.push("archwing")
      break
    // Companion weapons split by attaching companion type
    case "Robotic": // Sentinel weapons
    case "Beast": // Kavat/Kubrow/Vulpaphyla/Predasite claws
    case "Hound": // Hound weapons
      out.push("companion-weapons")
      break
    // Railjack — turrets, ordnance, and reactors live in the catalog under
    // their own browse category in principle, but the Railjack browse tab
    // is intentionally hidden for now (see CATEGORIES in
    // apps/web/src/lib/catalog.ts). Skip emission so they don't show up in
    // browse results; the editor's railjack handling stays dormant until we
    // resurface them.
    case "Railjack Turret":
    case "Railjack Ordnance":
      break
    // Necramech exalted melee (e.g. Voidrig's Pugil) — surfaces as a melee
    // with exalted tag
    case "Nech-Melee":
      out.push("melee")
      break
    // Modular parts / utility — not surfaced as standalone items
    case "Amp":
    case "Gear":
    case "Vehicle":
    case "Emplacement":
    case "Unique":
      return []
    case undefined:
    case null:
      // No wiki Slot. Fall back to DE productCategory when we have either some
      // wiki data (displayClass) OR a riven disposition — the latter lets a
      // brand-new real weapon (in DE, not yet on the wiki) still emit, while
      // disposition-less SpecialItems noise stays dropped.
      if (!w.displayClass && w.omegaAttenuation === undefined) return []
      {
        const wikiless = WIKILESS_PRODUCT_CATEGORIES[w.productCategory]
        if (wikiless) out.push(wikiless.category)
      }
      break
    default:
      // Unknown wiki Slot. Don't guess — drop and surface in diagnostics.
      return []
  }

  if (isExalted) out.push("exalted-weapons")
  return out
}
