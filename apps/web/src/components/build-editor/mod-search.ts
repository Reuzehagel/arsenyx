import { isStanceMod } from "@arsenyx/shared/warframe/mods"
import type { Mod } from "@arsenyx/shared/warframe/types"

import { fuzzyRank } from "@/lib/fuzzy"

import type { ModSlotKind } from "./mod-slot"
import { isAuraMod, isExilusCompatible } from "./use-build-slots"

export function slotKindPredicate(kind: ModSlotKind | undefined) {
  if (!kind || kind === "normal") return null
  if (kind === "aura") return (m: Mod) => isAuraMod(m)
  if (kind === "stance") return (m: Mod) => isStanceMod(m)
  return (m: Mod) => !isAuraMod(m) && !isStanceMod(m) && isExilusCompatible(m)
}

// Soft-filter pass: which of `hardFiltered` match the query + slot kind, and
// the display order with matches floated to the front.
export function searchMods(
  hardFiltered: Mod[],
  query: string,
  searchIndex: Map<string, string>,
  selectedSlotKind: ModSlotKind | undefined,
): { displayed: Mod[]; matches: Set<string> } {
  const q = query.trim()
  const qLower = q.toLowerCase()
  const hasQuery = q.length > 0
  const kindPred = slotKindPredicate(selectedSlotKind)

  // Fuzzy-rank mod *names* (typo-tolerant: "seration" → Serration). Names are
  // short discrete labels, the case uFuzzy is good at. The wider searchable
  // text (stats, aliases, target — see getSearchable / #160) stays a substring
  // check so a fuzzy match over that big blob can't over-match.
  const nameRank = new Map<string, number>()
  if (hasQuery) {
    const ranked = fuzzyRank(
      hardFiltered.map((m) => m.name),
      q,
    )
    ranked.forEach((idx, rank) =>
      nameRank.set(hardFiltered[idx].uniqueName, rank),
    )
  }

  const set = new Set<string>()
  const hits: Mod[] = []
  const rest: Mod[] = []
  for (const m of hardFiltered) {
    const queryHit =
      !hasQuery ||
      nameRank.has(m.uniqueName) ||
      (searchIndex.get(m.uniqueName) ?? "").includes(qLower)
    const matchesFilters = queryHit && (!kindPred || kindPred(m))
    if (matchesFilters) {
      set.add(m.uniqueName)
      hits.push(m)
    } else {
      rest.push(m)
    }
  }
  // Float name matches to the front by relevance; everything else keeps the
  // user's chosen sort order (stable sort preserves it for equal ranks).
  if (hasQuery) {
    hits.sort(
      (a, b) =>
        (nameRank.get(a.uniqueName) ?? Infinity) -
        (nameRank.get(b.uniqueName) ?? Infinity),
    )
  }
  const shouldFloat = hasQuery || !!kindPred
  return {
    matches: set,
    displayed: shouldFloat ? [...hits, ...rest] : hardFiltered,
  }
}

// A card the user can place: matches the filters, not already equipped, and
// not mutually exclusive with an equipped mod.
export function isActionable(
  m: Mod,
  matches: Set<string>,
  usedModNames: Set<string> | undefined,
  conflictUniqueNames: Set<string> | undefined,
): boolean {
  return (
    matches.has(m.uniqueName) &&
    !(usedModNames?.has(m.name) ?? false) &&
    !(conflictUniqueNames?.has(m.uniqueName) ?? false)
  )
}
