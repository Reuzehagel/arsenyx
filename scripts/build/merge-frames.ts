/**
 * Merge DE warframe/archwing/necramech records + wiki Warframes/data into
 * our normalized frame shape. The Operator category exists on the wiki but
 * not in DE — we include it from the wiki side only.
 *
 * DE ships everything in a single flat `ExportWarframes` array, with
 * `productCategory ∈ {"Suits","SpaceSuits","MechSuits"}` differentiating
 * the rows. Archwing frames also carry a `<ARCHWING> ` prefix on the DE
 * name that needs stripping to match wiki keys.
 *
 * Polarity data comes from the wiki — DE doesn't ship frame polarities or
 * aura polarities at all. The wiki carries `Polarities` and `AuraPolarity`
 * on each frame entry.
 */

import type { DeFrame } from "./read-de"
import { normalizePolarity, normalizePolarities } from "./polarity"
import { cleanDeName } from "./names"

type FrameCategory = "warframes" | "archwing" | "necramechs" | "operators"

export interface MergedFrame {
  uniqueName: string
  name: string
  category: FrameCategory
  description: string
  health: number
  shield: number
  armor: number
  stamina?: number
  power: number
  sprintSpeed?: number
  masteryReq: number
  passiveDescription?: string
  exalted: readonly string[]
  /** DE compatNames a mod can carry to be installable on this frame.
   *  Mirrors `MergedWeapon.modPools` so consumers can use the same
   *  `modPools.includes(mod.compatName)` predicate uniformly. */
  modPools: readonly string[]
  /** Each frame's four standard abilities, plus the passive on warframes. */
  abilities: ReadonlyArray<{
    uniqueName: string
    name: string
    description: string
    imageName?: string
  }>
  /** Lowercase polarity names from wiki Polarities (8 slots). */
  polarities: readonly string[]
  /** Aura slot polarity (warframes + archwing + necramech only). Array
   *  when the frame has more than one aura slot (e.g. Jade has two). */
  auraPolarity: string | string[] | null
  /** Exilus polarity (warframes only, when set in-game). */
  exilusPolarity: string | null
  /** True when this frame has a Prime variant (derived from name). */
  isPrime: boolean
}

interface WikiFrame {
  Name?: string
  Polarities?: readonly unknown[]
  /** Single string for most frames; array for multi-aura frames like Jade. */
  AuraPolarity?: string | readonly unknown[]
  ExilusPolarity?: string
  /** Subsumable ability on warframes — useful for Helminth derivation. */
  Subsumed?: string
}

/** Wiki AuraPolarity is a string for single-aura frames and an array for
 *  multi-aura frames (Jade: `{ "Aura", "Vazarin" }`). Return one of:
 *  string (single slot), string[] (multi-slot), or null (no aura slot). */
function normalizeAuraPolarity(p: unknown): string | string[] | null {
  if (Array.isArray(p)) {
    const arr = normalizePolarities(p)
    return arr.length === 0 ? null : arr
  }
  return normalizePolarity(p)
}

function categoryOf(productCategory: string): FrameCategory {
  switch (productCategory) {
    case "Suits":
      return "warframes"
    case "SpaceSuits":
      return "archwing"
    case "MechSuits":
      return "necramechs"
    default:
      throw new Error(`Unknown frame productCategory "${productCategory}"`)
  }
}

interface FrameWikiTable {
  Warframes?: Record<string, WikiFrame>
  Archwings?: Record<string, WikiFrame>
  Necramechs?: Record<string, WikiFrame>
  Operators?: Record<string, WikiFrame>
}

/** Look up the wiki record across all four sub-tables. */
function findWikiFrame(name: string, wiki: FrameWikiTable): WikiFrame | undefined {
  return (
    wiki.Warframes?.[name] ??
    wiki.Archwings?.[name] ??
    wiki.Necramechs?.[name] ??
    wiki.Operators?.[name]
  )
}

export interface MergeFramesOpts {
  wiki: FrameWikiTable
  unmatched: Set<string>
}

/** Build the mod-pool list for a frame.
 *
 *  Warframes accept three classes of mods:
 *    - "WARFRAME" mods (the general pool)
 *    - "AURA" mods (the dedicated aura slot)
 *    - per-frame augment mods, keyed by the frame's name. Primes accept
 *      the base name's augments too (`isPrime` strips " Prime" suffix).
 *
 *  Necramechs / Archwings each have their own pool, plus per-name
 *  augments. Operators take no mods (they use Focus, not mods). */
function modPoolsForFrame(name: string, category: FrameCategory): readonly string[] {
  switch (category) {
    case "warframes": {
      const pools = new Set<string>(["WARFRAME", "AURA", name])
      if (name.endsWith(" Prime")) pools.add(name.slice(0, -" Prime".length))
      return [...pools]
    }
    case "necramechs":
      return ["Necramech", name]
    case "archwing":
      return ["Archwing", name]
    case "operators":
      return []
  }
}

export function mergeFrame(
  de: DeFrame,
  opts: MergeFramesOpts,
): MergedFrame {
  const cleanName = cleanDeName(de.name)
  const wiki = findWikiFrame(cleanName, opts.wiki)
  if (!wiki) opts.unmatched.add(cleanName)

  const polarities = normalizePolarities(wiki?.Polarities ?? [])
  const category = categoryOf(de.productCategory)

  return {
    uniqueName: de.uniqueName,
    name: cleanName,
    category,
    description: de.description ?? "",
    health: de.health,
    shield: de.shield,
    armor: de.armor,
    stamina: de.stamina,
    power: de.power,
    sprintSpeed: de.sprintSpeed,
    masteryReq: de.masteryReq ?? 0,
    passiveDescription: de.passiveDescription,
    exalted: de.exalted ?? [],
    modPools: modPoolsForFrame(cleanName, category),
    // DE uses abilityUniqueName/abilityName; rename to match the existing
    // BrowseableItem Ability shape the UI consumes.
    abilities: (de.abilities ?? []).map((a) => ({
      uniqueName: a.abilityUniqueName,
      name: a.abilityName,
      description: a.description,
      imageName: a.imageName,
    })),
    polarities,
    auraPolarity: normalizeAuraPolarity(wiki?.AuraPolarity),
    exilusPolarity: normalizePolarity(wiki?.ExilusPolarity),
    isPrime: cleanName.includes(" Prime"),
  }
}

/** Add wiki-only Operator entries (no DE rows for these). */
export function operatorsFromWiki(wiki: FrameWikiTable): MergedFrame[] {
  const out: MergedFrame[] = []
  for (const [name, op] of Object.entries(wiki.Operators ?? {})) {
    out.push({
      uniqueName: `/Lotus/Types/Game/CharacterCustomization/Operator/${name.replace(/\s+/g, "")}`,
      name,
      category: "operators",
      description: "",
      health: 0,
      shield: 0,
      armor: 0,
      power: 0,
      masteryReq: 0,
      exalted: [],
      abilities: [],
      polarities: normalizePolarities(op.Polarities ?? []),
      auraPolarity: normalizeAuraPolarity(op.AuraPolarity),
      exilusPolarity: null,
      isPrime: false,
      modPools: modPoolsForFrame(name, "operators"),
    })
  }
  return out
}
