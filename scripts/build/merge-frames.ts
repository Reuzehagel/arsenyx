/**
 * Merge DE warframe/archwing/necramech records + wiki Warframes/data into
 * our normalized frame shape. The Operator category exists on the wiki but
 * not in DE — we include it from the wiki side only.
 *
 * DE ships everything in a single flat `ExportWarframes` array, with
 * `productCategory ∈ {"Suits","SpaceSuits","MechSuits","SpecialItems"}`
 * differentiating the rows ("SpecialItems" is the Orion & Sirius twin-frame,
 * treated as a warframe — see `categoryOf`). Archwing frames also carry a
 * `<ARCHWING> ` prefix on the DE name that needs stripping to match wiki keys.
 *
 * Polarity data comes from the wiki — DE doesn't ship frame polarities or
 * aura polarities at all. The wiki carries `Polarities` and `AuraPolarity`
 * on each frame entry.
 */

import type { FramePolarityOverride } from "../../data/curated/frame-polarities"
import { cleanDeName } from "./names"
import { normalizePolarity, normalizePolarities } from "./polarity"
import type { DeFrame } from "./read-de"

type FrameCategory = "warframes" | "archwing" | "necramechs" | "operators"

interface FrameAbility {
  uniqueName: string
  name: string
  description: string
  imageName?: string
}

/** One switchable form of a twin-frame (e.g. Sirius & Orion). Forms have
 *  SEPARATE upgrade menus in game, so each carries its own polarities (Sirius
 *  aura = Vazarin, Orion aura = Naramon). */
export interface MergedFrameForm {
  name: string
  abilities: readonly FrameAbility[]
  passiveDescription?: string
  exalted: readonly string[]
  polarities: readonly string[]
  auraPolarity: string | string[] | null
  exilusPolarity: string | null
}

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
  abilities: readonly FrameAbility[]
  /** Twin-frames only: the switchable forms (`forms[0]` is the primary and
   *  mirrors the top-level `abilities`/`passiveDescription`/`exalted`). */
  forms?: readonly MergedFrameForm[]
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
    // DE buckets the Orion & Sirius twin-frame under "SpecialItems" rather
    // than "Suits" (uniqueName /Lotus/Powersuits/SiriusOrion/OrionSuit). It's
    // a regular Warframe — full stats/abilities/passive — so treat it as one.
    case "SpecialItems":
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
function findWikiFrame(
  name: string,
  wiki: FrameWikiTable,
): WikiFrame | undefined {
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
  /** Frame name → wiki-verified polarity fallback for frames the wiki data
   *  module hasn't catalogued yet (e.g. the Sirius & Orion twin-frame). */
  polarityOverrides?: Record<string, FramePolarityOverride>
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
function modPoolsForFrame(
  name: string,
  category: FrameCategory,
): readonly string[] {
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

export function mergeFrame(de: DeFrame, opts: MergeFramesOpts): MergedFrame {
  const cleanName = cleanDeName(de.name)
  const wiki = findWikiFrame(cleanName, opts.wiki)
  if (!wiki) opts.unmatched.add(cleanName)

  // Wiki is authoritative; the curated override only fills gaps for frames the
  // wiki data module hasn't catalogued yet (e.g. the Sirius & Orion twin-frame,
  // whose two forms have different aura polarities).
  const override = opts.polarityOverrides?.[cleanName]
  // A twin-frame's two forms share ONE combined wiki entry whose
  // Polarities/AuraPolarity list both halves' slots (aura markers inline) and
  // can't be split back per-form — left to the wiki the primary form renders
  // two aura slots and a doubled polarity bar. A `force` override suppresses
  // the wiki's polarity data for that frame; every other frame keeps the wiki
  // authoritative (it still drives match/unmatched detection above).
  const polarityWiki = override?.force ? undefined : wiki
  const wikiPolarities = normalizePolarities(polarityWiki?.Polarities ?? [])
  const polarities = wikiPolarities.length
    ? wikiPolarities
    : (override?.polarities ?? [])
  const auraPolarity =
    normalizeAuraPolarity(polarityWiki?.AuraPolarity) ??
    normalizeAuraPolarity(override?.auraPolarity)
  const exilusPolarity =
    normalizePolarity(polarityWiki?.ExilusPolarity) ??
    normalizePolarity(override?.exilusPolarity)
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
    auraPolarity,
    exilusPolarity,
    isPrime: cleanName.includes(" Prime"),
  }
}

/** Twin-frames that DE ships as two separate `ExportWarframes` rows sharing a
 *  uniqueName prefix (one codex-visible "Suits" row + one `excludeFromCodex`
 *  "SpecialItems" row). We collapse each pair into ONE catalog entity carrying
 *  both ability sets under `forms`. `primaryUnique` is the form players control
 *  by default and the one Helminth can infuse on — it becomes `forms[0]` and
 *  the top-level (back-compat) abilities/passive/exalted. */
const TWIN_FRAMES: ReadonlyArray<{ prefix: string; primaryUnique: string }> = [
  {
    prefix: "/Lotus/Powersuits/SiriusOrion/",
    primaryUnique: "/Lotus/Powersuits/SiriusOrion/SiriusSuit",
  },
]

function toForm(f: MergedFrame): MergedFrameForm {
  return {
    name: f.name,
    abilities: f.abilities,
    passiveDescription: f.passiveDescription,
    exalted: f.exalted,
    polarities: f.polarities,
    auraPolarity: f.auraPolarity,
    exilusPolarity: f.exilusPolarity,
  }
}

/** Collapse known twin-frame pairs (see `TWIN_FRAMES`) into single entities.
 *  Unmatched/solo rows pass through untouched, so this is safe to run over the
 *  full merged-frame list before any downstream consumer (browse index, detail
 *  emit, helminth derivation, exalted union). */
export function collapseTwinFrames(frames: MergedFrame[]): MergedFrame[] {
  let out = frames
  for (const twin of TWIN_FRAMES) {
    const members = out.filter((f) => f.uniqueName.startsWith(twin.prefix))
    if (members.length < 2) continue // DE shape drifted — leave as-is.
    const primary =
      members.find((f) => f.uniqueName === twin.primaryUnique) ?? members[0]
    const others = members.filter((f) => f !== primary)
    const ordered = [primary, ...others]
    const merged: MergedFrame = {
      ...primary,
      modPools: [...new Set(ordered.flatMap((f) => f.modPools))],
      exalted: [...new Set(ordered.flatMap((f) => f.exalted))],
      forms: ordered.map(toForm),
    }
    // Swap the merged entity in for the primary and drop the other members.
    const otherSet = new Set(others)
    out = out
      .filter((f) => f === primary || !otherSet.has(f))
      .map((f) => (f === primary ? merged : f))
  }
  return out
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
