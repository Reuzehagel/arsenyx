import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"

/**
 * Interactive mod/arcane references in build guides (issue #228).
 *
 * Authors write a normal markdown link whose href uses a custom scheme:
 *
 *   [Corrosive Projection](mod:/Lotus/Upgrades/Mods/Aura/EnemyArmorReductionAura)
 *   [Arcane Energize](arcane:/Lotus/Upgrades/CosmeticEnhancers/Utility/EnergyOnEnergyPickup)
 *
 * The editor's `[[` autocomplete inserts these; MarkdownBody intercepts the
 * scheme and renders a hover/click detail card instead of an anchor.
 *
 * Resolution is snapshot-first: at save time the editor copies each referenced
 * mod/arcane from the catalog into `SavedBuildData.guideRefs`, so the viewer —
 * including the embed, which deliberately never downloads the ~1.35 MB
 * mods-all.json — renders cards from data already in the build payload.
 * Snapshots follow the same rules as placed slots: `imageName` is stripped on
 * persist and re-resolved by uniqueName at render (see build-codec-adapter's
 * stripPersistedImages / refreshImagesFromMap).
 */

/** Snapshots of every mod/arcane referenced in any of a build's guide texts
 *  (build-wide + per-variant), deduped by uniqueName. Stored inside
 *  `Build.buildData` (opaque JSON to the API). */
export type GuideRefs = {
  mods?: Mod[]
  arcanes?: Arcane[]
}

export type GuideRefTarget =
  | { kind: "mod"; mod: Mod }
  | { kind: "arcane"; arcane: Arcane }

/** Resolves a guide-ref href to renderable data. Returns null when the
 *  reference can't be resolved (no snapshot and no catalog entry) — the
 *  renderer then falls back to a plain wiki link. */
export type GuideRefResolver = (
  kind: "mod" | "arcane",
  uniqueName: string,
) => GuideRefTarget | null

/** Parse a `mod:<uniqueName>` / `arcane:<uniqueName>` href. uniqueNames are
 *  DE paths and always start with "/", which conveniently keeps the scheme
 *  unambiguous against real-world URLs. */
export function parseGuideRefHref(
  href: string,
): { kind: "mod" | "arcane"; uniqueName: string } | null {
  const m = /^(mod|arcane):(\/\S+)$/.exec(href)
  if (!m) return null
  return { kind: m[1] as "mod" | "arcane", uniqueName: m[2] }
}

// Matches the href half of a guide-ref markdown link in raw guide text.
// uniqueNames never contain whitespace or parens, so this can't over-match
// into surrounding prose.
const REF_IN_MARKDOWN = /\]\((mod|arcane):(\/[^()\s]+)\)/g

/**
 * Scan guide markdown sources for references and snapshot the matching
 * catalog entries. Unknown uniqueNames are skipped (the renderer falls back
 * to a wiki link), duplicates collapse to one snapshot. Returns undefined
 * when nothing matched so `buildData` doesn't grow an empty key.
 */
export function collectGuideRefs(
  sources: (string | undefined)[],
  mods: Mod[],
  arcanes: Arcane[],
): GuideRefs | undefined {
  const modNames = new Set<string>()
  const arcaneNames = new Set<string>()
  for (const source of sources) {
    if (!source) continue
    for (const m of source.matchAll(REF_IN_MARKDOWN)) {
      ;(m[1] === "mod" ? modNames : arcaneNames).add(m[2])
    }
  }
  const refMods = mods.filter((m) => modNames.has(m.uniqueName))
  const refArcanes = arcanes.filter((a) => arcaneNames.has(a.uniqueName))
  if (refMods.length === 0 && refArcanes.length === 0) return undefined
  return {
    ...(refMods.length > 0 && { mods: refMods }),
    ...(refArcanes.length > 0 && { arcanes: refArcanes }),
  }
}

/**
 * Build a resolver over any mod/arcane source: the build's stored snapshots
 * (viewer/embed) or the full catalogs (editor live preview — snapshots don't
 * exist until save). Lookups are prebuilt Maps so resolving inside the
 * markdown render path stays O(1) even against the ~1600-mod catalog.
 */
export function makeRefResolver(
  mods: Mod[] | undefined,
  arcanes: Arcane[] | undefined,
): GuideRefResolver {
  const modsByName = new Map(mods?.map((m) => [m.uniqueName, m]))
  const arcanesByName = new Map(arcanes?.map((a) => [a.uniqueName, a]))
  return (kind, uniqueName) => {
    if (kind === "mod") {
      const mod = modsByName.get(uniqueName)
      return mod ? { kind: "mod", mod } : null
    }
    const arcane = arcanesByName.get(uniqueName)
    return arcane ? { kind: "arcane", arcane } : null
  }
}
