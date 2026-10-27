/**
 * Join wiki `Module:Ability/data/stats` onto frame + Helminth abilities.
 *
 * The wiki keys entries by asset path, but under a different folder than DE
 * (`/Lotus/Powersuits/PowersuitAbilities/IcicleAbility` vs DE's
 * `/Lotus/Powersuits/Frost/Abilities/IcicleAbility`), so we match on the last
 * path segment. Prime variants that ship their own asset (Caliban Prime, Gyre
 * Prime, ...) fall back to the one other ability sharing their name.
 *
 * Values are max-rank only; the wiki carries no per-rank arrays here.
 */

import type {
  AbilityStat,
  AbilityStatScale,
} from "@arsenyx/shared/warframe/types"

interface WikiAbilityStat {
  Label?: string
  Modifier?: string
  Values?: Record<string, number>
  HelminthValues?: Record<string, number>
  Max?: number
  HelminthMax?: number
  Min?: number
  RoundTo?: number
  InverseModifier?: boolean
  OperationType?: string
}

/** Every key `toStat` reads or deliberately drops. An unknown one fails the
 *  build so a new upstream field gets handled instead of silently lost. */
const KNOWN_KEYS = new Set([
  "Label",
  "Modifier",
  "Values",
  "HelminthValues",
  "Max",
  "HelminthMax",
  "Min",
  "RoundTo",
  "InverseModifier",
  "OperationType",
])

const SCALES: Record<string, AbilityStatScale> = {
  AVATAR_ABILITY_STRENGTH: "strength",
  AVATAR_ABILITY_DURATION: "duration",
  AVATAR_ABILITY_RANGE: "range",
  AVATAR_ABILITY_EFFICIENCY: "efficiency",
  ENERGY_DRAIN: "drain",
}

const basename = (uniqueName: string) =>
  uniqueName.slice(uniqueName.lastIndexOf("/") + 1)

/** `{ Val1 = 40, Val2 = 85 }` → `[40, 85]`. */
function valueList(
  v: Record<string, number> | undefined,
): number[] | undefined {
  if (!v) return undefined
  const out: number[] = []
  for (let i = 1; v[`Val${i}`] !== undefined; i++) out.push(v[`Val${i}`]!)
  return out.length ? out : undefined
}

function toStat(w: WikiAbilityStat): AbilityStat | null {
  for (const k of Object.keys(w)) {
    if (!KNOWN_KEYS.has(k)) {
      throw new Error(
        `Unhandled ability stat key "${k}" on "${w.Label}" — map it in merge-ability-stats.ts`,
      )
    }
  }
  if (!w.Label) return null
  // shortcut: InverseModifier / OperationType="ADD" rows (3 in the module)
  // scale in ways the wiki doesn't document; dropped rather than shown wrong.
  if (w.InverseModifier || w.OperationType) return null
  const values = valueList(w.Values)
  const scale = w.Modifier ? SCALES[w.Modifier] : undefined
  if (values && w.Modifier && w.Modifier !== "NONE" && !scale) {
    throw new Error(
      `Unknown ability stat Modifier "${w.Modifier}" on "${w.Label}"`,
    )
  }
  const stat: AbilityStat = {
    // The wiki source spells the degree sign as a broken `xb0` escape.
    label: w.Label.replace(/xb0/g, "°"),
  }
  if (scale) stat.scale = scale
  if (values) stat.values = values
  const helminth = valueList(w.HelminthValues)
  if (helminth) stat.helminthValues = helminth
  if (w.Max !== undefined) stat.max = w.Max
  if (w.HelminthMax !== undefined) stat.helminthMax = w.HelminthMax
  if (w.Min !== undefined) stat.min = w.Min
  if (w.RoundTo !== undefined) stat.round = w.RoundTo
  return stat
}

export interface AbilityRef {
  uniqueName: string
  name: string
}

/** Build a `(ability) → stats` lookup from the parsed wiki module. `known` is
 *  every ability the catalog emits; it feeds the by-name Prime fallback. */
export function abilityStatsLookup(
  wiki: Record<string, unknown>,
  known: readonly AbilityRef[],
): (a: AbilityRef) => AbilityStat[] | undefined {
  const byAsset = new Map<string, AbilityStat[]>()
  for (const [key, rows] of Object.entries(wiki)) {
    if (!Array.isArray(rows)) continue
    const stats = (rows as WikiAbilityStat[])
      .map(toStat)
      .filter((s): s is AbilityStat => s !== null)
    if (stats.some((s) => s.values)) byAsset.set(basename(key), stats)
  }

  // name → stats, only where exactly one distinct matched asset has that name.
  const byName = new Map<string, AbilityStat[] | null>()
  const seen = new Set<string>()
  for (const a of known) {
    const asset = basename(a.uniqueName)
    const stats = byAsset.get(asset)
    if (!stats || seen.has(asset)) continue
    seen.add(asset)
    byName.set(a.name, byName.has(a.name) ? null : stats)
  }

  return (a) =>
    byAsset.get(basename(a.uniqueName)) ?? byName.get(a.name) ?? undefined
}
