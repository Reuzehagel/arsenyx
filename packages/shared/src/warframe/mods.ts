/**
 * Mod compatibility helpers. Pure functions — caller supplies the raw WFCD
 * mods array. The build script normalizes once and filters per item.
 */

import type { Mod, ModCompatibility, Polarity } from "./types"

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

/** Strip variants/tutorial/nemesis duplicates and normalize polarity + special rarities. */
export function normalizeMods(rawMods: Mod[]): Mod[] {
  const modSetIndex = new Map<string, Mod>()
  for (const mod of rawMods) {
    if (mod.uniqueName && mod.stats) {
      modSetIndex.set(mod.uniqueName, mod)
    }
  }

  return rawMods
    .filter((mod) => {
      if (!mod.name) return false
      if (mod.name.includes("Riven Mod")) return false
      if (!mod.compatName && !mod.type) return false
      if (mod.description?.includes("Conclave")) return false
      // Plexus "Unfused Artifact" entries are pre-fusion placeholders with
      // no stats; they're not buildable in-game.
      if (mod.name === "Unfused Artifact") return false

      const uniqueName = mod.uniqueName ?? ""
      if (uniqueName.includes("/Beginner/")) return false
      if (uniqueName.endsWith("Intermediate")) return false
      if (uniqueName.endsWith("Expert") && !mod.name.includes("Primed"))
        return false
      if (uniqueName.includes("/Nemesis/")) return false
      if (uniqueName.endsWith("SubMod")) return false
      // Unused upstream entry that ships as a second "Pressure Point" with
      // +200% Melee Damage + +120% combo count chance. Not a real in-game
      // mod; @wfcd/items keeps it for parity with the game files.
      if (
        uniqueName ===
        "/Lotus/Upgrades/Mods/Melee/WeaponMeleeDamageOnHeavyKillMod"
      )
        return false

      return true
    })
    .map((mod) => {
      let modSetStats: string[] | undefined
      if (mod.modSet) {
        const setMod = modSetIndex.get(mod.modSet)
        if (setMod?.stats) modSetStats = setMod.stats
      }

      let rarity = mod.rarity
      if (mod.name.startsWith("Amalgam ")) rarity = "Amalgam"
      else if (mod.name.startsWith("Galvanized ")) rarity = "Galvanized"

      return {
        ...mod,
        polarity: normalizePolarity(mod.polarity as unknown as string),
        modSetStats,
        rarity,
      }
    })
}

// --- compatibility matchers ---

export function isStanceMod(mod: Pick<Mod, "type">): boolean {
  return mod.type?.toLowerCase() === "stance mod"
}

function isMeleeCompat(compatName: string, modType: string) {
  // Arch-Melee shares the substring "melee" but uses its own mod pool.
  if (compatName === "archmelee" || modType.includes("arch-melee")) return false
  return (
    compatName === "melee" ||
    modType.includes("melee") ||
    modType === "stance mod"
  )
}

function modMatchesCompat(mod: Mod, compatibility: ModCompatibility): boolean {
  const compatName = mod.compatName?.toLowerCase() ?? ""
  const modType = mod.type?.toLowerCase() ?? ""

  switch (compatibility) {
    case "Warframe":
      return (
        modType.includes("warframe") &&
        (compatName === "warframe" || compatName === "aura")
      )
    case "Aura":
      return modType.includes("aura") || compatName === "aura"
    case "Exilus":
      return mod.isExilus === true || mod.isUtility === true
    case "Rifle":
      return compatName === "rifle" || modType.includes("rifle")
    case "Shotgun":
      return compatName === "shotgun" || modType.includes("shotgun")
    case "Pistol":
      if (compatName === "tome") return false
      return compatName === "pistol" || modType.includes("secondary")
    case "Melee":
      return isMeleeCompat(compatName, modType)
    case "Companion":
      return (
        modType.includes("companion") ||
        modType.includes("sentinel") ||
        modType.includes("beast")
      )
    case "Necramech":
      return modType.includes("necramech")
    case "Archgun":
      return compatName === "archgun" || modType.includes("arch-gun")
    case "Archmelee":
      return compatName === "archmelee" || modType.includes("arch-melee")
    case "Archwing":
      return compatName === "archwing" || modType.includes("archwing")
    case "Plexus":
      // Every Plexus mod is `type: "Plexus Mod"` in WFCD — no need to inspect
      // compatName or uniqueName path. Sub-slot kind (Battle/Tactical/
      // Integrated) is resolved separately by `getPlexusSlotKind`.
      return modType === "plexus mod"
    default:
      return false
  }
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
 * and slot-kind helpers can't drift on a casing change in WFCD data. */
export function isPlexusMod(mod: Pick<Mod, "type">): boolean {
  return mod.type?.toLowerCase() === "plexus mod"
}

/** Identifies the "Aura"/Matrix mods that only fit the Plexus Aura slot.
 * WFCD distinguishes them by a negative `baseDrain` (they add capacity
 * when equipped instead of consuming it). Matrix-named mods (Ironclad,
 * Indomitable, Orgone Tuning, Onslaught, Raider) carry baseDrain: -2. */
export function isPlexusAuraMod(mod: Mod): boolean {
  return isPlexusMod(mod) && mod.baseDrain < 0
}

const CATEGORY_TO_COMPAT: Record<string, ModCompatibility[]> = {
  warframes: ["Warframe"],
  primary: ["Rifle", "Shotgun"],
  secondary: ["Pistol"],
  melee: ["Melee"],
  "exalted-weapons": ["Rifle", "Pistol", "Melee"],
  necramechs: ["Necramech"],
  companions: ["Companion"],
  archwing: ["Archwing", "Archgun", "Archmelee"],
  railjack: ["Plexus"],
}

// Tome weapons (Grimoire, Noctua) accept Tome mods — `compatName: "Tome"`,
// `type: "Secondary Mod"` — in addition to the standard secondary pool. Tome
// mods are exclusive to these two weapons, so every other secondary must
// exclude them (see isPistolMod / modMatchesCompat). Match on name prefix so a
// future variant (e.g. a Grimoire Prime) is covered automatically.
function isTomeWeapon(name?: string): boolean {
  const lower = name?.toLowerCase() ?? ""
  return lower.startsWith("grimoire") || lower.startsWith("noctua")
}

/**
 * Return the mods compatible with the given item.
 *
 * Modern path (Phase 6 collapse): the item carries `modPools` — the list
 * of mod `compatName` values it accepts, computed once at build time
 * from wiki Class + curated overrides. Filtering is a single set
 * membership check (`modPools.includes(mod.compatName)`), plus a
 * narrow filter for stance mods (class-specific) and exilus utility.
 *
 * Legacy path: when `modPools` is absent (synthetic items, builds
 * imported from before the cutover) we fall back to the category-only
 * routing via `CATEGORY_TO_COMPAT`. Type-based name-pattern routing
 * (`Bubonico is a Rifle → Shotgun` etc.) is gone — that class of bug
 * is what motivated the rewrite.
 *
 * `mods` must already be normalized via `normalizeMods`.
 */
export function getModsForItem(
  item: {
    /** DEPRECATED — kept in signature for back-compat with older call
     *  sites. The structural router ignores this entirely; pass
     *  `modPools` instead. Removed in a follow-up sweep. */
    type?: string
    category?: string
    name?: string
    trigger?: string
    /** Lowercase stance compatibility (e.g. "polearms", "swords"). When
     *  set, stance mods are filtered to that class only; when absent,
     *  all stance mods that match the broader modPools pass. */
    meleeClass?: string
    uniqueName?: string
    /** DEPRECATED — Beast claws routing used to require a curated
     *  compatGroups list. The new pipeline encodes those compatNames
     *  directly into `modPools`. Kept for legacy callers. */
    compatGroups?: string[]
    /** Phase 6 routing field: the DE `compatName` values this item
     *  accepts. Includes generic pools ("Rifle", "WARFRAME"), refinement
     *  pools ("Sniper", "Polearms"), the item's own name (for augments),
     *  and family/base names where applicable. */
    modPools?: readonly string[]
  },
  mods: Mod[],
): Mod[] {
  const meleeClass = item.meleeClass?.toLowerCase()

  // Modern path: structural routing via modPools.
  if (item.modPools && item.modPools.length > 0) {
    const poolSet = new Set(item.modPools)
    return mods.filter((mod) => {
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

  // Legacy fallback: category-driven routing for items whose pipeline
  // hasn't been migrated to emit modPools.
  const category = item.category?.toLowerCase()
  if (category === "railjack") {
    return mods.filter((m) => modMatchesCompat(m, "Plexus"))
  }
  const compats = category ? CATEGORY_TO_COMPAT[category] : undefined
  if (!compats) return []
  const itemName = item.name
  const isTome = isTomeWeapon(itemName)
  return mods.filter((m) => {
    if ((m.compatName?.toLowerCase() ?? "") === "tome") return isTome
    return compats.some((c) => modMatchesCompat(m, c))
  })
}
