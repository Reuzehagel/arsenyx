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

function isPrimaryMod(compatName: string, modType: string, subtype: string) {
  if (compatName === subtype) return true
  if (modType.includes(subtype)) return true
  if (subtype !== "shotgun" && compatName === "rifle") return true
  if (subtype !== "shotgun" && compatName === "rifle (no aoe)") return true
  if (subtype !== "shotgun" && compatName === "assault rifle") return true
  if (compatName === "primary") return true
  if (
    modType.includes("primary") &&
    !compatName &&
    !modType.includes("rifle") &&
    !modType.includes("shotgun") &&
    !modType.includes("sniper") &&
    !modType.includes("launcher") &&
    !modType.includes("bow")
  )
    return true
  return false
}

function isPistolMod(compatName: string, modType: string) {
  return (
    compatName === "pistol" ||
    modType.includes("secondary") ||
    modType.includes("pistol")
  )
}

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

const PRIMARY_SUBTYPES = ["rifle", "shotgun", "sniper", "launcher", "bow"]

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

/**
 * Return the mods compatible with the given item. `mods` must already be
 * normalized via `normalizeMods`.
 */
// Necramechs are categorized as `Warframes` in WFCD data — detect them by
// name so we can route them to the necramech mod pool instead of the
// warframe one. Mirrors `isNecramech` in categorize.ts.
function isNecramechItem(name?: string): boolean {
  if (!name) return false
  return (
    name.includes("Necramech") || name === "Bonewidow" || name === "Voidrig"
  )
}

// Necramech exalted weapons (Arquebex, Ironbride) share `type: "Exalted
// Weapon"` with warframe exalteds. Their uniqueName lives under the Entrati
// NechroTech / EntratiMech paths, which is how we tell them apart.
function isNecramechExalted(uniqueName?: string): boolean {
  if (!uniqueName) return false
  return uniqueName.includes("NechroTech") || uniqueName.includes("EntratiMech")
}

export function getModsForItem(
  item: {
    type?: string
    category?: string
    name?: string
    trigger?: string
    meleeClass?: string
    uniqueName?: string
    /** Lowercased compatNames a Beast Weapon accepts. Synthesized at
     * build time in scripts/beast-claws.ts. */
    compatGroups?: string[]
  },
  mods: Mod[],
): Mod[] {
  const itemType = item.type
  const itemName = item.name
  const meleeClass = item.meleeClass?.toLowerCase()

  // Railjack (Plexus) short-circuits ahead of the per-type pipeline because
  // its synthetic item has no `type` matching any weapon/warframe branch.
  if (item.category?.toLowerCase() === "railjack") {
    return mods.filter((m) => modMatchesCompat(m, "Plexus"))
  }

  // Necramechs carry `type: "Warframe"` in WFCD data; intercept before the
  // warframe branch so they get necramech mods, not warframe mods.
  if (isNecramechItem(itemName)) {
    return mods.filter((m) =>
      (m.type?.toLowerCase() ?? "").includes("necramech"),
    )
  }

  if (!itemType) {
    const category = item.category?.toLowerCase()
    const compats = category ? CATEGORY_TO_COMPAT[category] : undefined
    if (!compats) return []
    return mods.filter((m) => compats.some((c) => modMatchesCompat(m, c)))
  }

  const itemTypeLower = itemType.toLowerCase()
  const itemNameLower = itemName?.toLowerCase() ?? ""

  if (itemTypeLower === "zaw component") {
    return mods.filter((m) => modMatchesCompat(m, "Melee"))
  }

  return mods.filter((mod) => {
    const compatName = mod.compatName?.toLowerCase() ?? ""
    const modType = mod.type?.toLowerCase() ?? ""

    if (PRIMARY_SUBTYPES.includes(itemTypeLower)) {
      if (
        modType.includes("primary") &&
        compatName &&
        itemNameLower.includes(compatName)
      )
        return true
      return isPrimaryMod(compatName, modType, itemTypeLower)
    }

    if (itemTypeLower === "pistol" || itemTypeLower === "throwing") {
      if (
        modType.includes("secondary") &&
        compatName &&
        itemNameLower.includes(compatName)
      )
        return true
      return isPistolMod(compatName, modType)
    }

    if (itemTypeLower === "melee") {
      // Stance mods are class-specific (Polearms, Glaives, ...). When we know
      // the weapon's class, only offer stances matching it; fail open if not.
      if (modType === "stance mod") {
        if (!meleeClass) return true
        return compatName === meleeClass
      }
      if (
        modType.includes("melee") &&
        compatName &&
        itemNameLower.includes(compatName)
      )
        return true
      return isMeleeCompat(compatName, modType)
    }

    if (itemTypeLower === "arch-gun")
      return compatName === "archgun" || modType.includes("arch-gun")
    if (itemTypeLower === "arch-melee")
      return compatName === "archmelee" || modType.includes("arch-melee")
    if (itemTypeLower === "archwing")
      return compatName === "archwing" || modType.includes("archwing")

    if (itemTypeLower === "beast weapon") {
      // Beast claws accept several compat groups: the generic "Claws"
      // (Bite/Maul/stances/postures), per-pet finisher mods (Ferocity →
      // "Sahasa Kubrow"), per-class mods (Swipe → "Kavat Claws"), per-family
      // mods (Volatile Parasite → "Predasite"), and the lone Helminth Charger
      // mod (Strain Fever → "Helminth Claws"). The weapon item carries a
      // pre-resolved `compatGroups` list so this matcher is data-driven.
      return Boolean(
        item.compatGroups &&
        compatName &&
        item.compatGroups.includes(compatName),
      )
    }

    if (itemTypeLower === "companion weapon") {
      // Sentinel weapons share mod pools with their primary-weapon analogues.
      // Deconstructor(/Prime) is a thrown glaive → melee mods, but it has no
      // stance slot in-game so exclude stance mods to keep the picker clean.
      // Sweeper(/Prime) is a shotgun → shotgun mods. Everything else
      // (Verglas, Vulklok, Deth Machine Rifle, Burst Laser, etc.) → rifle.
      // Match on name prefix rather than uniqueName — Deconstructor and
      // Deconstructor Prime live under different uniqueName paths
      // (.../SentGlaiveWeapon vs .../DeconstructorPrime/PrimeHeliosGlaiveWeapon).
      if (itemNameLower.startsWith("deconstructor")) {
        if (modType === "stance mod") return false
        return isMeleeCompat(compatName, modType)
      }
      if (itemNameLower.startsWith("sweeper"))
        return compatName === "shotgun" || modType.includes("shotgun")
      return isPrimaryMod(compatName, modType, "rifle")
    }

    if (itemTypeLower === "exalted weapon") {
      // Necramech exalteds use Archgun/Archmelee mods (Arquebex → Archgun,
      // Ironbride → Archmelee), routed by whether the weapon has a trigger.
      if (isNecramechExalted(item.uniqueName)) {
        if (item.trigger)
          return compatName === "archgun" || modType.includes("arch-gun")
        return compatName === "archmelee" || modType.includes("arch-melee")
      }
      if (itemNameLower.includes("bow"))
        return isPrimaryMod(compatName, modType, "bow")
      if (item.trigger) return isPistolMod(compatName, modType)
      // Exalted melees have a stance pre-applied in-game that the player can't
      // swap, so they get no stance slot — exclude stance mods from the pool
      // (otherwise `isMeleeCompat` lets them through). Mirrors the Deconstructor
      // exclusion above.
      if (modType === "stance mod") return false
      return isMeleeCompat(compatName, modType)
    }

    if (itemTypeLower === "warframe") {
      if (
        modType.includes("warframe") &&
        (compatName === "warframe" || compatName === "aura")
      )
        return true
      if (itemName && mod.isAugment && modType.includes("warframe")) {
        const baseItemName = itemNameLower.replace(" prime", "")
        if (compatName === itemNameLower || compatName === baseItemName)
          return true
      }
      return false
    }

    if (itemTypeLower === "necramech") return modType.includes("necramech")

    if (["companion", "sentinel", "beast", "pets"].includes(itemTypeLower)) {
      return (
        modType.includes("companion") ||
        modType.includes("sentinel") ||
        modType.includes("beast")
      )
    }

    return false
  })
}
