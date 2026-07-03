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
    /** Weapon intrinsic tags (GRNBOW, SEMI_AUTO, PROJECTILE, …) used to
     *  refine `compatName`-level routing against a mod's tag requirements.
     *  Absent on frames/companions/untagged weapons → full tag refinement is
     *  skipped, but see `trigger` for a partial fallback on untagged weapons. */
    compatTags?: readonly string[]
    /** DE firing mode (SEMI, AUTO, BURST, HELD, …). PE+ leaves ~66 weapons
     *  (Furis, Vasto, Kohm, …) without `compatTags`; for those we fall back to
     *  the two restriction tags decidable from `trigger` alone — SEMI_AUTO and
     *  BEAM — so firing-mode-gated mods don't leak. See the partial path below. */
    trigger?: string
  },
  mods: Mod[],
): Mod[] {
  if (!item.modPools || item.modPools.length === 0) return []

  const meleeClass = item.meleeClass?.toLowerCase()
  const itemUniqueName = item.uniqueName
  const poolSet = new Set(item.modPools)
  // Built once (not per-mod) so the tag refinement is O(1) membership.
  const itemTags =
    item.compatTags && item.compatTags.length > 0
      ? new Set(item.compatTags)
      : null
  const trigger = item.trigger?.toUpperCase()

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

    // Tag refinement (OpenWF): `compatName` routes by broad class, but some
    // mods only fit a subset the class can't express — e.g. Semi-Rifle
    // Cannonade (Rifle, but semi-auto only) or Split Flights (Bow, but not
    // Grineer bows like the Kuva Bramma). Only applied when the item carries
    // tags (weapons); untagged items (frames/companions/wiki-only) are
    // permissive so we never wrongly hide a mod.
    if (itemTags) {
      // Excluded if the item has any tag the mod forbids.
      if (mod.incompatTags?.some((t) => itemTags.has(t))) return false
      // If the mod requires tags, the item must have at least one (ANY-of).
      // Stances are exempt: they're already routed by compatName/meleeClass
      // below, and their `*_STANCE` requirement is absent on power/sentinel
      // weapons (POWER_WEAPON/SENTINEL_WEAPON), so applying it would wrongly
      // hide stances from exalted and companion melee.
      if (
        !isStanceMod(mod) &&
        mod.compatTags &&
        mod.compatTags.length > 0 &&
        !mod.compatTags.some((t) => itemTags.has(t))
      ) {
        return false
      }
    } else if (
      trigger &&
      !isStanceMod(mod) &&
      mod.compatTags &&
      mod.compatTags.length > 0
    ) {
      // Partial fallback for weapons PE+ left untagged (no `compatTags`). The
      // full ANY-of check above can't run, so firing-mode-gated mods would all
      // leak — Semi-Pistol Cannonade onto auto pistols, Ruinous Extension (a
      // beam-only mod) onto the Furis. We can still rule out the two tags that
      // are decidable from the authoritative `trigger` field alone:
      //   • SEMI_AUTO — the weapon has it iff its trigger is SEMI
      //   • BEAM      — an untagged weapon is never a beam weapon (PE+ tags
      //                 every beam weapon), so the weapon never has it
      // Only decide when EVERY tag the mod requires is one of these two; for
      // anything else (PROJECTILE, ammo tags) we can't derive the weapon's
      // status from `trigger`, so we stay permissive — wrongly hiding a usable
      // mod is worse than the occasional leak.
      const decidableOnly = mod.compatTags.every(
        (t) => t === "SEMI_AUTO" || t === "BEAM",
      )
      // The only decidable tag an untagged weapon can carry is SEMI_AUTO, and
      // only when its trigger is SEMI (BEAM is never present). So a
      // decidable-only mod passes iff it requires SEMI_AUTO on a SEMI weapon.
      const weaponHasRequired =
        trigger === "SEMI" && mod.compatTags.includes("SEMI_AUTO")
      if (decidableOnly && !weaponHasRequired) return false
    }

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

// --- mutual-exclusion (conflict) helpers ---
//
// Some mods are variants of the same base — Serration / Amalgam Serration /
// Spectral Serration all modify base damage — and the game forbids equipping
// more than one. The dedupe-by-name gate doesn't catch this because the
// variants have distinct names. The authoritative list lives in the wiki's
// per-mod `Incompatible` field; the build pipeline resolves it into a
// symmetric `uniqueName → uniqueName[]` graph and serves it as
// `/data/mod-conflicts.json` (see scripts/build-items-index.ts).

/** uniqueName → mod uniqueNames it's mutually exclusive with. Symmetric and
 *  restricted to the emitted catalog. A mod with no conflicts is absent. */
export type ModConflictMap = Record<string, readonly string[]>

/** Ability a warframe augment modifies, parsed from DE's "<Ability> Augment:"
 *  description prefix (e.g. "Decoy Augment: …" → "Decoy"). Returns null for
 *  non-augments and for weapon augments, which describe a flat stat
 *  ("+75% Damage") with no such prefix. Same convention the helminth
 *  augment-routing in search-panel keys off. */
export function getAugmentAbility(
  mod: Pick<Mod, "isAugment" | "levelStats">,
): string | null {
  if (!mod.isAugment) return null
  const desc = mod.levelStats?.[0]?.stats?.[0] ?? ""
  // Most read "Decoy Augment:", but a few carry a stray space before the colon
  // ("Sol Gate Augment :", "Blaze Artillery Augment :"), so tolerate it.
  const match = desc.match(/^(.+?) Augment\s*:/)
  return match ? match[1]! : null
}

/**
 * Mutual-exclusion edges for warframe ability augments. The game forbids
 * equipping two augments for the same ability ("Different Augments affecting
 * the same ability or passive cannot be equipped together" —
 * wiki.warframe.com/w/Augment_Mods), e.g. Loki's Decoy has three augments
 * (Decoy / Deceptive Bond / Savior Decoy / Damage Decoy) and only one may be
 * slotted. The per-mod `Incompatible` field that backs the rest of
 * mod-conflicts.json doesn't record these, so derive them from the catalog:
 * group augments by owning frame (`compatName`) + ability, then make every
 * augment in a group mutually exclusive with the others.
 *
 * Returns the same symmetric `uniqueName → uniqueName[]` shape as
 * mod-conflicts.json, covering only groups with ≥2 augments. The build merges
 * this into the wiki/variant edges (see scripts/build/mod-conflicts.ts).
 */
export function deriveAbilityAugmentConflicts(
  mods: readonly Pick<
    Mod,
    "uniqueName" | "compatName" | "isAugment" | "levelStats"
  >[],
): ModConflictMap {
  // (frame + ability) → augment uniqueNames sharing that ability. The NUL
  // separator can't appear in either part, so the key is unambiguous.
  const byAbility = new Map<string, string[]>()
  for (const mod of mods) {
    const ability = getAugmentAbility(mod)
    if (!ability || !mod.compatName) continue
    const key = `${mod.compatName}\0${ability}`
    const group = byAbility.get(key)
    if (group) group.push(mod.uniqueName)
    else byAbility.set(key, [mod.uniqueName])
  }
  // Each mod lands in exactly one (frame + ability) group, so the groups are
  // disjoint — no cross-group dedup is needed, and within a group everyone
  // conflicts with everyone else. Sorted output is the contract callers rely on.
  const out: Record<string, string[]> = {}
  for (const group of byAbility.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort()
    for (const a of sorted) out[a] = sorted.filter((b) => b !== a)
  }
  return out
}

/** True when two mods are mutually exclusive. Order-independent (the map is
 *  symmetric, but we check both directions to tolerate a one-sided map). */
export function modsConflict(
  a: string,
  b: string,
  conflicts: ModConflictMap,
): boolean {
  return Boolean(conflicts[a]?.includes(b) || conflicts[b]?.includes(a))
}

/** uniqueNames among `placed` that are mutually exclusive with at least one
 *  *other* placed mod. Drives the read-only warning on an already-built
 *  loadout. Returns a Set for O(1) membership. */
export function getConflictingUniqueNames(
  placed: readonly string[],
  conflicts: ModConflictMap,
): Set<string> {
  const flagged = new Set<string>()
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (modsConflict(placed[i]!, placed[j]!, conflicts)) {
        flagged.add(placed[i]!)
        flagged.add(placed[j]!)
      }
    }
  }
  return flagged
}

/** uniqueNames that conflict with *any* currently-placed mod — the set the
 *  picker dims so a user can't stack a second variant of a mod they already
 *  run. The placed mods themselves are excluded (the dedupe gate owns those).
 *  Symmetric data means the union of each placed mod's conflict list suffices. */
export function getBlockedByConflict(
  placed: readonly string[],
  conflicts: ModConflictMap,
): Set<string> {
  const blocked = new Set<string>()
  const placedSet = new Set(placed)
  for (const un of placed) {
    for (const c of conflicts[un] ?? []) {
      if (!placedSet.has(c)) blocked.add(c)
    }
  }
  return blocked
}

/** Connected components of mutually-exclusive placed mods, each a group of
 *  ≥2 uniqueNames that can't legally coexist. Drives the warning banner's
 *  per-group "keep only one" message. Mods with no conflict are omitted.
 *  Input order is preserved within and across groups. */
export function groupConflictingMods(
  placed: readonly string[],
  conflicts: ModConflictMap,
): string[][] {
  const flagged = getConflictingUniqueNames(placed, conflicts)
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const start of placed) {
    if (!flagged.has(start) || seen.has(start)) continue
    // Walk the conflict graph breadth-first, staying inside the placed set.
    const group: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length > 0) {
      const cur = queue.shift()!
      group.push(cur)
      for (const next of placed) {
        if (seen.has(next) || !flagged.has(next)) continue
        if (modsConflict(cur, next, conflicts)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    if (group.length > 1) groups.push(group)
  }
  return groups
}
