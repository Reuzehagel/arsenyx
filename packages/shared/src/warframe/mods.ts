/**
 * Mod compatibility helpers. Pure functions — caller supplies the raw
 * mods array. The build script normalizes once and filters per item.
 */

import type { Mod, Polarity } from "./types"

export function normalizePolarity(polarity?: string): Polarity {
  if (!polarity || typeof polarity !== "string") return "universal"
  const lower = polarity.toLowerCase()

  const map: Record<string, Polarity> = {
    madurai: "madurai",
    vazarin: "vazarin",
    naramon: "naramon",
    zenurik: "zenurik",
    unairu: "unairu",
    penjaga: "penjaga",
    umbra: "umbra",
    any: "any",
    universal: "universal",
    d: "vazarin",
    r: "madurai",
    dash: "naramon",
    v: "madurai",
  }

  return map[lower] ?? "universal"
}

// --- compatibility matchers ---

export function isStanceMod(mod: Pick<Mod, "type">): boolean {
  return mod.type?.toLowerCase() === "stance"
}

/** Pulls the set codename out of a mod's `modSet` path (e.g.
 * `/Lotus/Upgrades/Mods/Sets/Augur/AugurSetMod` → `"Augur"`).
 * Returns null when the mod isn't part of a set. The codename is the
 * internal segment from the DE path, not the in-game set name — e.g.
 * "Boneblade" backs the Jugulus set, "Sacrifice" backs Sacrificial.
 * Callers that need the display/icon name should map through
 * `SET_CODE_TO_ICON_NAME` (apps/web). */
export function getModSetCode(mod: Pick<Mod, "modSet">): string | null {
  if (!mod.modSet) return null
  const seg = mod.modSet.split("/Sets/")[1]?.split("/")[0]
  return seg ?? null
}

/** Sub-slot kind for a Plexus mod. Path segment after `/Railjack/` in the
 * mod's uniqueName is the canonical taxonomy:
 *   `Abilities`  → battle
 *   `Tactical`   → tactical
 *   `Engineering` | `Gunnery` | `Piloting` → integrated
 *     (the `integrated` bucket further splits into `aura` (Matrix mods,
 *     identified by negative baseDrain) and regular integrated slots.
 *     `getPlexusSlotKind` returns `integrated` for both — call
 *     `isPlexusAuraMod` to disambiguate.)
 * Returns null for anything that isn't a Plexus mod. */
export type PlexusSlotKind = "battle" | "tactical" | "integrated"

export function getPlexusSlotKind(mod: Mod): PlexusSlotKind | null {
  if (mod.type?.toLowerCase() !== "plexus mod") return null
  const segment = mod.uniqueName.split("/Railjack/")[1]?.split("/")[0]
  if (!segment) return null
  if (segment === "Abilities") return "battle"
  if (segment === "Tactical") return "tactical"
  if (
    segment === "Engineering" ||
    segment === "Gunnery" ||
    segment === "Piloting"
  )
    return "integrated"
  return null
}

/** True when the mod is a Plexus (Railjack) mod. Use this everywhere
 * instead of `mod.type === "Plexus Mod"` so the picker, placement gate,
 * and slot-kind helpers can't drift on a casing change in the mod data. */
export function isPlexusMod(mod: Pick<Mod, "type">): boolean {
  return mod.type?.toLowerCase() === "plexus mod"
}

/** Identifies the "Aura"/Matrix mods that only fit the Plexus Aura slot.
 * The data distinguishes them by a negative `baseDrain` (they add capacity
 * when equipped instead of consuming it). Matrix-named mods (Ironclad,
 * Indomitable, Orgone Tuning, Onslaught, Raider) carry baseDrain: -2. */
export function isPlexusAuraMod(mod: Mod): boolean {
  return isPlexusMod(mod) && mod.baseDrain < 0
}

/**
 * Return the mods compatible with the given item.
 *
 * Routing is a single set-membership check against the item's `modPools` —
 * the list of mod `compatName` values it accepts, computed at build time
 * from wiki Class + curated overrides (`modPools.includes(mod.compatName)`)
 * — plus a narrow refinement for class-specific stance mods and the
 * augment gate. Every catalog item carries a non-empty `modPools` (the
 * build seeds it with the item's own name at minimum), so an item without
 * one matches nothing.
 *
 * `mods` must already be the filtered catalog set the build emits (see
 * `shouldKeep` in scripts/build/merge-mods.ts) — this does no further filtering.
 */
export function getModsForItem(
  item: {
    /** Lowercase stance compatibility (e.g. "polearms", "swords"). When
     *  set, stance mods are filtered to that class only; when absent,
     *  all stance mods that match the broader modPools pass. */
    meleeClass?: string
    uniqueName?: string
    /** The DE `compatName` values this item
     *  accepts. Includes generic pools ("Rifle", "WARFRAME"), refinement
     *  pools ("Sniper", "Polearms"), the item's own name (for augments),
     *  and family/base names where applicable. */
    modPools?: readonly string[]
  },
  mods: Mod[],
): Mod[] {
  if (!item.modPools || item.modPools.length === 0) return []

  const meleeClass = item.meleeClass?.toLowerCase()
  const itemUniqueName = item.uniqueName
  const poolSet = new Set(item.modPools)

  return mods.filter((mod) => {
    // OpenWF augment gate: `compatItems` is a build-time-resolved
    // closed list of item uniqueNames this mod fits (expanded from
    // OpenWF's raw `compat` field — see build-items-index.ts). When
    // present, the mod is locked to those exact items. This is the
    // authoritative source — no string/name matching, no wiki-Class
    // inference, no curated overrides.
    if (mod.compatItems) {
      // Authoritative and exhaustive: the mod fits exactly these items and
      // nothing else. Skip the pool/name refinement below — it would wrongly
      // drop e.g. an Excalibur augment on Excalibur Umbra, whose `modPools`
      // carries "Excalibur Umbra" but not the augment's "Excalibur" compatName.
      return Boolean(itemUniqueName && mod.compatItems.includes(itemUniqueName))
    }

    const compatName = mod.compatName ?? ""
    if (!poolSet.has(compatName)) return false
    // Stance mods are class-specific. The item's modPools already
    // includes the stance-compat name (e.g. "Polearms") — but a
    // melee weapon's pool also includes the generic "Melee" pool,
    // and a stance mod with `compatName: "Polearms"` would only fire
    // for polearms. So pool membership is necessary AND sufficient;
    // the meleeClass refinement is only useful when modPools is
    // missing the stance-compat (very old items / synthesized).
    if (isStanceMod(mod) && meleeClass && compatName) {
      return compatName.toLowerCase() === meleeClass
    }
    return true
  })
}
