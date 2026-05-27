/**
 * Merge DE Sentinels/KubrowPets + wiki Companions/data into our normalized
 * companion shape.
 *
 * The architecture doc flags DE as undercounting companions (only 15
 * KubrowPets vs the full breed list on the wiki). The wiki's
 * `Module:Companions/data` is the authoritative list — we iterate over
 * wiki entries and look up DE for stat refinements, rather than the
 * weapon-style "iterate DE, look up wiki".
 */

import type { DeSentinel } from "./read-de"

export type CompanionCategory = "sentinel" | "beast" | "moa" | "hound"

export interface MergedCompanion {
  uniqueName: string
  name: string
  /** Companion sub-type — "sentinel" for Wyrm/Carrier/etc., "beast" for
   *  Kubrow/Kavat/Vulpaphyla/Predasite, "moa" for MOAs, "hound" for Hounds. */
  subType: CompanionCategory
  description: string
  health: number
  shield: number
  armor: number
  power?: number
  masteryReq: number
  polarities: readonly string[]
  /** Wiki CompatibilityTags — used by the mod-pool routing to know if a
   *  given mod targets this companion class. */
  compatTags: readonly string[]
  isPrime: boolean
}

interface WikiCompanion {
  Name?: string
  Category?: string
  Health?: number
  Shield?: number
  Armor?: number
  Energy?: number
  Mastery?: number
  Polarities?: readonly unknown[]
  CompatibilityTags?: readonly unknown[]
  Description?: string
  InternalName?: string
}

const POLARITY_SET = new Set<string>([
  "madurai", "vazarin", "naramon", "zenurik", "unairu", "penjaga",
  "umbra", "aura", "exilus", "universal", "any",
])

function normalizePolarity(p: unknown): string | null {
  if (typeof p !== "string" || p.length === 0) return null
  const lower = p.toLowerCase()
  return POLARITY_SET.has(lower) ? lower : lower
}

/** Map wiki Category string to our subType enum. */
function subTypeOf(wikiCategory: string | undefined): CompanionCategory {
  switch ((wikiCategory ?? "").toLowerCase()) {
    case "sentinels":
      return "sentinel"
    case "moas":
      return "moa"
    case "hounds":
      return "hound"
    case "beasts":
    case "kubrows":
    case "kavats":
    case "vulpaphylas":
    case "predasites":
    case "kubrow":
    case "kavat":
      return "beast"
    default:
      // Fallback: assume beast (most undocumented entries are beast breeds).
      return "beast"
  }
}

export interface MergeCompanionsOpts {
  /** Wiki Companions/data top-level "Companions" sub-table. */
  wikiCompanions: Record<string, WikiCompanion>
  /** DE sentinels indexed by clean name for stat backfill. */
  deByName: Map<string, DeSentinel>
}

export function mergeCompanions(
  opts: MergeCompanionsOpts,
): { companions: MergedCompanion[]; unmatchedDeNames: string[] } {
  const companions: MergedCompanion[] = []
  const seenInternalNames = new Set<string>()

  for (const [name, wiki] of Object.entries(opts.wikiCompanions)) {
    const internal = (wiki.InternalName as string | undefined) ?? ""
    const de = opts.deByName.get(name)
    if (de) seenInternalNames.add(de.name)

    companions.push({
      // Prefer DE's uniqueName (it's the canonical game ID and what the
      // game's RPC layer uses). The wiki InternalName for some Primes
      // points at the base entry, which would conflate Wyrm + Wyrm Prime.
      uniqueName: de?.uniqueName || internal || `/Lotus/Companions/${name.replace(/\s+/g, "")}`,
      name,
      subType: subTypeOf(wiki.Category),
      description: (wiki.Description as string | undefined) ?? de?.description ?? "",
      health: (wiki.Health as number | undefined) ?? de?.health ?? 0,
      shield: (wiki.Shield as number | undefined) ?? de?.shield ?? 0,
      armor: (wiki.Armor as number | undefined) ?? de?.armor ?? 0,
      power: (wiki.Energy as number | undefined) ?? de?.power,
      masteryReq: (wiki.Mastery as number | undefined) ?? de?.masteryReq ?? 0,
      polarities: (wiki.Polarities ?? [])
        .map(normalizePolarity)
        .filter((p): p is string => p !== null),
      compatTags: (wiki.CompatibilityTags as readonly string[] | undefined) ?? [],
      isPrime: name.includes(" Prime"),
    })
  }

  // Track DE records that didn't get matched in the wiki pass (probably
  // SpecialItems-category entries like the standalone Venari we already see).
  const unmatched: string[] = []
  for (const [name] of opts.deByName) {
    if (!seenInternalNames.has(name)) unmatched.push(name)
  }
  return { companions, unmatchedDeNames: unmatched }
}
