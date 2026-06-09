/**
 * Expand OpenWF's mod `compat` field into a closed `compatItems` list — the
 * exact catalog item uniqueNames an augment fits. The runtime check then
 * collapses to a single `compatItems.includes(item.uniqueName)`.
 *
 * `compat` is one of three things:
 *
 *   1. A specific item uniqueName (weapon/companion augments). We fan it out
 *      across the item's variant `family` (base, Prime, Wraith, Vandal, …) so
 *      the augment reaches every variant — e.g. Velox Conclusion, whose compat
 *      is the base Velox, also fits Velox Prime. Variants share a `family`
 *      string but live in different uniqueName directories (base Velox under
 *      `…/TnOdaliskSmg/`, Velox Prime under `…/PrimeVelox/`), so a path-prefix
 *      heuristic can't group them — the family index is the only link.
 *   2. A frame "BaseSuit" anchor like `/Lotus/Powersuits/Excalibur/
 *      ExcaliburBaseSuit`. DE's `parentName` chain doesn't fully resolve
 *      (intermediate suits like `DarkExcalibur` aren't first-class records),
 *      so we use a path-prefix heuristic: it expands to every catalog frame in
 *      the same `/Lotus/Powersuits/<Family>/` directory. Covers Excalibur ↔
 *      ExcaliburPrime ↔ ExcaliburUmbra without depending on DE shipping the
 *      full chain. Frames carry no `family`, so they take this branch, not (1).
 *   3. A generic class anchor (e.g. `.../PlayerMeleeWeapon`) — returns `[]`;
 *      `modPools` already covers the equivalent routing and the caller strips
 *      the field.
 */

/** Path tokens that mark a frame/necramech "BaseSuit" anchor, each gated to a
 *  category so the path-prefix heuristic can't pull a same-directory exalted
 *  weapon in as a "frame variant". */
export const BASE_SUIT_ANCHORS = [
  { token: "BaseSuit", cat: "warframes" },
  { token: "BaseMechSuit", cat: "necramechs" },
] as const

export interface FamilyIndex {
  /** uniqueName → `${category} ${family}` key. */
  familyKeyByUniqueName: Map<string, string>
  /** `${category} ${family}` key → member uniqueNames. */
  familyMembers: Map<string, string[]>
}

/**
 * Group catalog items into variant families keyed by `${category} ${family}`.
 * Items without a `family` (frames) or without a known category are skipped.
 * The key folds in category so a shared family name can't bridge an
 * exalted/regular split.
 */
export function buildFamilyIndex(
  items: readonly { uniqueName: string; family?: string | null }[],
  categoryByUniqueName: ReadonlyMap<string, string>,
): FamilyIndex {
  const familyKeyByUniqueName = new Map<string, string>()
  const familyMembers = new Map<string, string[]>()
  for (const item of items) {
    const fam = item.family
    const cat = categoryByUniqueName.get(item.uniqueName)
    if (!fam || !cat) continue
    // Skip a uniqueName we've already registered. Two distinct records can
    // share an id when a not-yet-released variant leaks into DE's export under
    // the base weapon's uniqueName (e.g. Athodai / "Athodai Prime"); without
    // this guard the family list double-counts it and the augment's
    // compatItems ends up with a duplicate entry.
    if (familyKeyByUniqueName.has(item.uniqueName)) continue
    const key = `${cat} ${fam}`
    familyKeyByUniqueName.set(item.uniqueName, key)
    const members = familyMembers.get(key) ?? []
    members.push(item.uniqueName)
    familyMembers.set(key, members)
  }
  return { familyKeyByUniqueName, familyMembers }
}

export interface ExpandCompatDeps extends FamilyIndex {
  knownItemUniqueNames: ReadonlySet<string>
  categoryByUniqueName: ReadonlyMap<string, string>
}

/** Build the `compat → uniqueName[]` expander bound to a catalog snapshot. */
export function makeExpandCompat(
  deps: ExpandCompatDeps,
): (compat: string) => string[] {
  const {
    knownItemUniqueNames,
    categoryByUniqueName,
    familyKeyByUniqueName,
    familyMembers,
  } = deps

  return function expandCompat(compat: string): string[] {
    if (knownItemUniqueNames.has(compat)) {
      // Direct hit on an item: fan out to its family (Prime/Wraith/… variants).
      const key = familyKeyByUniqueName.get(compat)
      const members = key ? familyMembers.get(key) : undefined
      return members && members.length > 1 ? [...members] : [compat]
    }
    for (const { token, cat } of BASE_SUIT_ANCHORS) {
      if (!compat.includes(token)) continue
      const dir = compat.slice(0, compat.lastIndexOf("/") + 1)
      const out: string[] = []
      for (const un of knownItemUniqueNames) {
        if (un.startsWith(dir) && categoryByUniqueName.get(un) === cat) {
          out.push(un)
        }
      }
      return out
    }
    return []
  }
}
