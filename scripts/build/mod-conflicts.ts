/**
 * Mod conflict graph.
 *
 * The wiki tracks which mods are mutually exclusive (variants of the same
 * base — e.g. Serration / Amalgam Serration / Spectral Serration — that the
 * game forbids equipping together) via a per-mod name-keyed `Incompatible`
 * list. Resolve those names to uniqueNames and emit a symmetric adjacency
 * graph restricted to the mods we actually ship, so the editor/viewer can
 * flag illegal loadouts. Names that don't resolve to an emitted mod (Conclave
 * variants, unreleased mods, Flawed mods we filter) are simply dropped — a
 * dead edge can't matter at runtime since the mod can never be placed.
 */

/** Minimal shape this module reads off an emitted mod. */
interface NamedMod {
  uniqueName: string
  name: string
}

export function buildModConflicts(
  mergedMods: readonly NamedMod[],
  /** Owning mod display Name → its `Incompatible` list (display Names). */
  wikiIncompatByName: Map<string, string[]>,
  /** Mod display Name → wiki InternalName (= DE uniqueName). */
  wikiModUniqueNameByName: Map<string, string>,
): Record<string, string[]> {
  const emittedUniqueNames = new Set(mergedMods.map((m) => m.uniqueName))
  // Display Name → emitted DE uniqueName. The authoritative resolver: DE's
  // uniqueName is stable across wiki path renames, so keying on the shipped
  // catalog's own names avoids the wiki-InternalName drift that previously
  // dropped base↔Primed edges (Redirection, Steady Hands, Deadly Efficiency).
  // First-wins on the rare duplicate display name.
  const deNameToUniqueName = new Map<string, string>()
  for (const m of mergedMods) {
    if (!deNameToUniqueName.has(m.name))
      deNameToUniqueName.set(m.name, m.uniqueName)
  }
  // Resolve a wiki display Name to an emitted uniqueName: prefer the DE catalog
  // (stable), fall back to the wiki InternalName only when no shipped mod
  // carries that name. Returns undefined when nothing emitted matches.
  const resolveModName = (displayName: string): string | undefined => {
    const de = deNameToUniqueName.get(displayName)
    if (de) return de
    const wiki = wikiModUniqueNameByName.get(displayName)
    return wiki && emittedUniqueNames.has(wiki) ? wiki : undefined
  }
  const conflictGraph = new Map<string, Set<string>>()
  const addConflictEdge = (a: string, b: string): void => {
    if (a === b) return
    if (!emittedUniqueNames.has(a) || !emittedUniqueNames.has(b)) return
    if (!conflictGraph.has(a)) conflictGraph.set(a, new Set())
    if (!conflictGraph.has(b)) conflictGraph.set(b, new Set())
    conflictGraph.get(a)!.add(b)
    conflictGraph.get(b)!.add(a)
  }
  for (const [owningName, names] of wikiIncompatByName) {
    const a = resolveModName(owningName)
    if (!a) continue
    for (const conflictingName of names) {
      const b = resolveModName(conflictingName)
      if (b) addConflictEdge(a, b)
    }
  }
  // Structural base↔variant edges. A Primed / Umbral / Amalgam / Archon mod is
  // always mutually exclusive with its same-named base in-game, so derive those
  // edges straight from the catalog rather than trusting the wiki to list them.
  // This makes the "no two variants of one mod" guarantee independent of the
  // wiki `Incompatible` field — which lagged DE for recent Primed mods
  // (Redirection, Steady Hands, Deadly Efficiency), silently dropping the edge —
  // and self-heals as new Primed mods ship instead of requiring a curated list.
  // Cross-stem families (Sacrificial Pressure ↔ Pressure Point, Galvanized ↔
  // base) don't share a name prefix and keep relying on the wiki edges above.
  const VARIANT_PREFIXES = ["Primed ", "Umbral ", "Amalgam ", "Archon "]
  let derivedVariantEdges = 0
  for (const m of mergedMods) {
    const prefix = VARIANT_PREFIXES.find((p) => m.name.startsWith(p))
    if (!prefix) continue
    const base = deNameToUniqueName.get(m.name.slice(prefix.length))
    if (base && !conflictGraph.get(m.uniqueName)?.has(base)) {
      addConflictEdge(m.uniqueName, base)
      derivedVariantEdges++
    }
  }
  const modConflicts: Record<string, string[]> = {}
  let conflictEdgeCount = 0
  for (const [uniqueName, set] of conflictGraph) {
    modConflicts[uniqueName] = [...set].sort()
    conflictEdgeCount += set.size
  }
  console.log(
    `  conflicts: ${conflictGraph.size} mods, ${conflictEdgeCount / 2} pairs ` +
      `(${derivedVariantEdges} base↔variant derived structurally)`,
  )
  return modConflicts
}
