/**
 * Map each DE mod uniqueName to the wiki record that describes it, so every
 * wiki-sourced flag (IsExilus, Tradable, Conclave, _IgnoreEntry) and the
 * _report.json unmatched list agree on what "matched" means.
 *
 * Exact InternalName match first. The wiki's InternalName drifts from DE's
 * uniqueName for some mods (Cold Front: wiki `IceShieldAugment2Card` vs DE
 * `IceShieldAugmentTwoCard`, #399), so fall back to the display Name — only
 * when that Name is unique on both sides, so per-ability/variant copies
 * sharing a Name can't inherit each other's flags.
 */
export function resolveWikiModKeys(
  deMods: ReadonlyArray<{ uniqueName?: string; name?: string }>,
  wikiMods: ReadonlyArray<{ internalName: string; name?: unknown }>,
): Map<string, string> {
  const wikiInternalNames = new Set(wikiMods.map((w) => w.internalName))
  const wikiKeyByName = new Map<string, string | null>()
  for (const w of wikiMods) {
    if (typeof w.name !== "string") continue
    // null marks a Name shared by several wiki records — ambiguous.
    wikiKeyByName.set(w.name, wikiKeyByName.has(w.name) ? null : w.internalName)
  }
  const deNameCounts = new Map<string, number>()
  for (const u of deMods) {
    if (u.name) deNameCounts.set(u.name, (deNameCounts.get(u.name) ?? 0) + 1)
  }

  const out = new Map<string, string>()
  for (const u of deMods) {
    if (!u.uniqueName) continue
    if (wikiInternalNames.has(u.uniqueName)) {
      out.set(u.uniqueName, u.uniqueName)
      continue
    }
    if (!u.name || deNameCounts.get(u.name) !== 1) continue
    const wikiKey = wikiKeyByName.get(u.name)
    if (wikiKey) out.set(u.uniqueName, wikiKey)
  }
  return out
}
