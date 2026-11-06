/**
 * Wiki-sourced mod flags (Module:Mods/data): IsExilus, Tradable, Conclave,
 * _IgnoreEntry, and the `Incompatible` conflict lists.
 */

import { PVE_USABLE_CONCLAVE_MODS } from "../../data/curated/pve-usable-conclave-mods"
import { iterWikiRecords } from "./read-wiki"

/**
 * Map each DE mod uniqueName to the wiki record that describes it, so every
 * wiki-sourced flag and the _report.json unmatched list agree on what
 * "matched" means.
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

export interface WikiModFlags {
  /** DE uniqueName → InternalName of the wiki record describing it. */
  keyByUniqueName: Map<string, string>
  /** The per-mod flags below are keyed by DE uniqueName. */
  exilus: Map<string, boolean>
  /** Wiki `Tradable`. DE's ExportUpgrades carries no tradability, so this is
   *  the only source; it gates the build view's "Warframe Market" link. */
  tradable: Map<string, boolean>
  /** Wiki `Conclave = true` (the canonical PvP marker — the description's
   *  "in Conclave" covers only ~14% of them), minus PVE_USABLE_CONCLAVE_MODS:
   *  `Conclave` means "usable in Conclave", not "PvP-exclusive". */
  conclave: Set<string>
  /** Wiki `_IgnoreEntry = true`: records the wiki maintainers consider
   *  unreleased / non-functional (e.g. "Primed Streamline"). */
  ignore: Set<string>
  /** Every wiki mod display Name (gates merge-mods' Primed-Expert allowance). */
  knownNames: Set<string>
  /** Owning mod display Name → its `Incompatible` list (display Names) —
   *  mutually exclusive variants (Serration / Amalgam Serration / …). Keyed by
   *  Name because the wiki's InternalName drifts from DE's uniqueName for
   *  some recent Primed mods; mod-conflicts.ts resolves both endpoints by
   *  Name against the emitted catalog. */
  incompatByName: Map<string, string[]>
  /** Mod display Name → wiki InternalName (the last record wins). */
  uniqueNameByName: Map<string, string>
  /** DE mods matched by Name rather than InternalName (drift, for the log). */
  nameFallbacks: string[]
  /** PVE_USABLE_CONCLAVE_MODS entries no Conclave-flagged record carries
   *  (typo or wiki rename: the mod is hidden from the PvE picker again). */
  unmatchedPveUsable: string[]
}

/** Read every wiki-sourced mod flag from Module:Mods/data, resolved onto the
 *  DE mods (`deMods`) through one `resolveWikiModKeys` mapping. */
export function readWikiModFlags(
  wikiMods: unknown,
  deMods: ReadonlyArray<{ uniqueName?: string; name?: string }>,
  pveUsable: ReadonlySet<string> = PVE_USABLE_CONCLAVE_MODS,
): WikiModFlags {
  const records: Array<{ internalName: string; name: unknown }> = []
  // Raw flags keyed by InternalName; resolved onto DE mods below.
  const exilus = new Map<string, boolean>()
  const tradable = new Map<string, boolean>()
  const conclave = new Set<string>()
  const ignore = new Set<string>()
  const knownNames = new Set<string>()
  const uniqueNameByName = new Map<string, string>()
  const incompatByName = new Map<string, string[]>()
  for (const { internalName, record } of iterWikiRecords(wikiMods)) {
    const name = record["Name"]
    records.push({ internalName, name })
    if (typeof record["IsExilus"] === "boolean")
      exilus.set(internalName, record["IsExilus"])
    if (typeof record["Tradable"] === "boolean")
      tradable.set(internalName, record["Tradable"])
    if (record["Conclave"] === true) conclave.add(internalName)
    if (record["_IgnoreEntry"] === true) ignore.add(internalName)
    if (typeof name !== "string") continue
    knownNames.add(name)
    uniqueNameByName.set(name, internalName)
    const incompat = record["Incompatible"]
    if (Array.isArray(incompat)) {
      // Some wiki entries carry placeholder `""` names; drop them so they
      // never become a dead lookup key.
      incompatByName.set(
        name,
        incompat.filter((x): x is string => typeof x === "string" && x !== ""),
      )
    }
  }

  const keyByUniqueName = resolveWikiModKeys(deMods, records)
  const flags: WikiModFlags = {
    keyByUniqueName,
    exilus: new Map(),
    tradable: new Map(),
    conclave: new Set(),
    ignore: new Set(),
    knownNames,
    incompatByName,
    uniqueNameByName,
    nameFallbacks: [],
    unmatchedPveUsable: [...pveUsable].filter((n) => !conclave.has(n)),
  }
  for (const u of deMods) {
    const key = u.uniqueName && keyByUniqueName.get(u.uniqueName)
    if (!key) continue
    const un = u.uniqueName!
    const ex = exilus.get(key)
    if (ex !== undefined) flags.exilus.set(un, ex)
    const tr = tradable.get(key)
    if (tr !== undefined) flags.tradable.set(un, tr)
    if (conclave.has(key) && !pveUsable.has(key) && !pveUsable.has(un))
      flags.conclave.add(un)
    if (ignore.has(key)) flags.ignore.add(un)
    if (key !== un) flags.nameFallbacks.push(u.name!)
  }
  return flags
}
