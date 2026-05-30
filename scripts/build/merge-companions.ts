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
import { normalizePolarity } from "./polarity"

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
  isPrime: boolean
  /** DE compatNames a mod can carry to be installable on this companion.
   *  Same shape as MergedWeapon.modPools / MergedFrame.modPools so the
   *  consumer-side mod predicate is uniform across all item types. */
  modPools: readonly string[]
}

/** Build the mod-pool list for a companion. Mirrors the routing baked
 *  into the legacy `getModsForItem` predicate, but reshaped as data:
 *
 *  - All companions: "COMPANION" (generic pool), own name (augments).
 *  - Sentinels: + "Sentinel".
 *  - Beasts (Kubrow/Kavat/Vulpaphyla/Predasite/Helminth): + "BEAST".
 *  - MOAs: + "Moa", + "ROBOTIC".
 *  - Hounds: + "Hound", + "ROBOTIC". */
function modPoolsForCompanion(
  name: string,
  subType: CompanionCategory,
): readonly string[] {
  const pools = new Set<string>(["COMPANION", name])
  if (name.endsWith(" Prime")) pools.add(name.slice(0, -" Prime".length))
  switch (subType) {
    case "sentinel":
      pools.add("Sentinel")
      break
    case "beast":
      pools.add("BEAST")
      break
    case "moa":
      pools.add("Moa")
      pools.add("ROBOTIC")
      break
    case "hound":
      pools.add("Hound")
      pools.add("ROBOTIC")
      break
  }
  return [...pools]
}

interface WikiCompanion {
  Name?: string
  Category?: string
  /** Companion kind: "Sentinel" | "MOA" | "Hound" | "Kavat" | "Kubrow" |
   *  "Vulpaphyla" | "Predasite". This — not `Category` — is the subtype
   *  discriminator. */
  Type?: string
  Health?: number
  Shield?: number
  Armor?: number
  Energy?: number
  Mastery?: number
  Polarities?: readonly unknown[]
  Description?: string
  InternalName?: string
}

/** Map the wiki `Type` string to our subType enum. */
export function subTypeOf(wikiType: string | undefined): CompanionCategory {
  switch ((wikiType ?? "").toLowerCase()) {
    case "sentinel":
      return "sentinel"
    case "moa":
      return "moa"
    case "hound":
      return "hound"
    case "kavat":
    case "kubrow":
    case "vulpaphyla":
    case "predasite":
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

    const subType = subTypeOf(wiki.Type)
    companions.push({
      // Prefer DE's uniqueName (it's the canonical game ID and what the
      // game's RPC layer uses). The wiki InternalName for some Primes
      // points at the base entry, which would conflate Wyrm + Wyrm Prime.
      uniqueName: de?.uniqueName || internal || `/Lotus/Companions/${name.replace(/\s+/g, "")}`,
      name,
      subType,
      description: (wiki.Description as string | undefined) ?? de?.description ?? "",
      health: (wiki.Health as number | undefined) ?? de?.health ?? 0,
      shield: (wiki.Shield as number | undefined) ?? de?.shield ?? 0,
      armor: (wiki.Armor as number | undefined) ?? de?.armor ?? 0,
      power: (wiki.Energy as number | undefined) ?? de?.power,
      masteryReq: (wiki.Mastery as number | undefined) ?? de?.masteryReq ?? 0,
      polarities: (wiki.Polarities ?? [])
        .map(normalizePolarity)
        .filter((p): p is string => p !== null),
      isPrime: name.includes(" Prime"),
      modPools: modPoolsForCompanion(name, subType),
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
