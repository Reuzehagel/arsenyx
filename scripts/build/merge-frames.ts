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
  /** Each frame's four standard abilities, plus the passive on warframes. */
  abilities: ReadonlyArray<{
    uniqueName: string
    name: string
    description: string
    imageName?: string
  }>
  /** Lowercase polarity names from wiki Polarities (8 slots). */
  polarities: readonly string[]
  /** Aura slot polarity (warframes + archwing + necramech only). */
  auraPolarity: string | null
  /** Exilus polarity (warframes only, when set in-game). */
  exilusPolarity: string | null
  /** True when this frame has a Prime variant (derived from name). */
  isPrime: boolean
}

interface WikiFrame {
  Name?: string
  Polarities?: readonly unknown[]
  AuraPolarity?: string
  ExilusPolarity?: string
  /** Subsumable ability on warframes — useful for Helminth derivation. */
  Subsumed?: string
  /** Progenitor element on Kuva/Tenet variants — not used here. */
  Progenitor?: string
}

const POLARITY_SET = new Set<string>([
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
  "aura",
  "exilus",
  "universal",
  "any",
])

function normalizePolarity(p: unknown): string | null {
  if (typeof p !== "string" || p.length === 0) return null
  const lower = p.toLowerCase()
  return POLARITY_SET.has(lower) ? lower : lower
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

const ARCHWING_PREFIX = "<ARCHWING> "

/** Strip the `<ARCHWING> ` prefix DE puts on archwing frame names. */
function cleanDeName(name: string): string {
  return name.startsWith(ARCHWING_PREFIX)
    ? name.slice(ARCHWING_PREFIX.length)
    : name
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

export function mergeFrame(
  de: DeFrame,
  opts: MergeFramesOpts,
): MergedFrame {
  const cleanName = cleanDeName(de.name)
  const wiki = findWikiFrame(cleanName, opts.wiki)
  if (!wiki) opts.unmatched.add(cleanName)

  const polarities = (wiki?.Polarities ?? [])
    .map(normalizePolarity)
    .filter((p): p is string => p !== null)

  return {
    uniqueName: de.uniqueName,
    name: cleanName,
    category: categoryOf(de.productCategory),
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
    // DE uses abilityUniqueName/abilityName; rename to match the existing
    // BrowseableItem Ability shape the UI consumes.
    abilities: (de.abilities ?? []).map((a) => ({
      uniqueName: a.abilityUniqueName,
      name: a.abilityName,
      description: a.description,
      imageName: a.imageName,
    })),
    polarities,
    auraPolarity: normalizePolarity(wiki?.AuraPolarity),
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
      polarities: (op.Polarities ?? [])
        .map(normalizePolarity)
        .filter((p): p is string => p !== null),
      auraPolarity: normalizePolarity(op.AuraPolarity),
      exilusPolarity: null,
      isPrime: false,
    })
  }
  return out
}
