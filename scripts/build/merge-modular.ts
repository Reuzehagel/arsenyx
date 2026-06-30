/**
 * Build the modular-weapon stat tables from the wiki's `Module:Modular/data`.
 *
 * DE ships kitgun chambers/grips/loaders and zaw strikes/grips/links as
 * zero-stat shells (`CritChance = 0`, `Damage = { Impact = 0, … }`), so the
 * catalog JSON can't carry their real numbers. `Module:Modular/data` is the
 * only verifiable source: it holds each chamber's base crit/status/multiplier,
 * the per-grip damage + fire-rate tables, and the per-loader crit/status/
 * reload/magazine modifiers (and the equivalent zaw tables). We parse it into
 * the consumer-shaped `ModularData` and emit `/data/modular.json`, which the
 * stat panel reconstructs from at runtime (see apps/web/src/lib/kitgun-stats.ts).
 *
 * The one wrinkle is damage: the wiki gives a single flat `Damage[grip]` map
 * per chamber, but a chamber can have several attack modes (Sporelacer's Toxin
 * is its explosion; Tombfinger's Impact+Radiation is its normal shot). We
 * allocate each damage type to the attack mode that declares it in the wiki's
 * weapon `Attacks` array — which is exactly the per-attack damage-type
 * membership the zero-stat shells still encode. Damage types that no source
 * carries per-attack (e.g. Tombfinger's separate explosion magnitude, which is
 * a game-internal multiple absent from every wiki module) are left unallocated
 * rather than guessed.
 */

import type {
  DamageTypes,
  ModularData,
  ModularKitgunAttack,
  ModularKitgunChamber,
  ModularKitguns,
  ModularZaws,
} from "@arsenyx/shared/warframe/types"

import { lowerDamageKeys } from "./merge-damage"

// The parsed Lua tables are loosely typed; we narrow at use sites.
type Raw = Record<string, unknown>

interface RawChamber {
  CritChance?: number
  CritMultiplier?: number
  StatusChance?: number
  Magazine?: Record<string, number>
  Damage?: Record<string, Record<string, number>>
  FireRate?: Record<string, number>
}

interface RawLoader {
  CritChance?: number
  CritMultiplier?: number
  StatusChance?: number
  Reload?: number
  Magazine?: string
}

/** Lowercase a wiki damage map ("Impact" → "impact"), dropping zero/non-number
 *  entries. Reuses the catalog's damage-key transform so kitgun/zaw damage and
 *  weapon damage stay on one convention. */
function lowerDamage(d: Record<string, unknown> | undefined): DamageTypes {
  return (lowerDamageKeys(d) ?? {}) as DamageTypes
}

/** Lowercased damage-type keys an attack mode declares, in wiki order. */
function attackDamageKeys(attack: Raw): string[] {
  const dmg = attack.Damage as Record<string, unknown> | undefined
  if (!dmg) return []
  return Object.keys(dmg).map((k) => k.toLowerCase())
}

/**
 * Allocate a chamber's flat per-grip damage across its attack modes by
 * damage-type membership: each type goes to the first attack mode (in wiki
 * order) that declares it. Modes that end up with no damage are dropped — the
 * flat map carries no value for them (a chamber's separate explosion/bomblet
 * magnitudes aren't in any verifiable source, and a grip like Gibber zeroes
 * the projectile entirely), so emitting a 0 row would be misleading.
 */
function allocateDamage(
  flat: DamageTypes,
  wikiAttacks: readonly Raw[],
  label: string,
): ModularKitgunAttack[] {
  const modes: ModularKitgunAttack[] = wikiAttacks.map((a) => ({
    name: (a.AttackName as string) ?? "Normal Attack",
    damage: {},
  }))
  if (modes.length === 0) {
    // No attack structure (shouldn't happen for kitgun chambers); fall back to
    // a single Normal Attack carrying the whole map.
    return [{ name: "Normal Attack", damage: { ...flat } }]
  }
  const keysPerMode = wikiAttacks.map(attackDamageKeys)
  for (const [type, value] of Object.entries(flat)) {
    let target = keysPerMode.findIndex((keys) => keys.includes(type))
    if (target < 0) {
      // Fold an unmatched type onto the primary attack. For a single-mode
      // chamber that's unambiguous. For a multi-mode chamber it may steal
      // damage that belongs to an explosion/AoE mode — the per-grip damage map
      // and the catalog's per-attack membership are independently-edited wiki
      // tables, so warn loudly rather than mis-attribute it silently.
      if (modes.length > 1) {
        console.warn(
          `[merge-modular] ${label}: damage type "${type}" not declared by any ` +
            `attack mode (${modes.map((m) => m.name).join(", ")}) — folding onto "${modes[0]!.name}".`,
        )
      }
      target = 0
    }
    modes[target]!.damage[type as keyof DamageTypes] = value
  }
  return modes.filter((m) => Object.keys(m.damage).length > 0)
}

function buildChamber(
  raw: RawChamber,
  wikiAttacks: readonly Raw[],
  label: string,
): ModularKitgunChamber {
  const grips: ModularKitgunChamber["grips"] = {}
  for (const [grip, dmgMap] of Object.entries(raw.Damage ?? {})) {
    // "Base" is the pre-grip reference value the wiki keeps for its own
    // tables; it isn't a selectable grip, so skip it.
    if (grip === "Base") continue
    const fireRate = raw.FireRate?.[grip]
    if (fireRate === undefined) continue
    grips[grip] = {
      fireRate,
      attacks: allocateDamage(
        lowerDamage(dmgMap),
        wikiAttacks,
        `${label} ${grip}`,
      ),
    }
  }
  return {
    critChance: raw.CritChance ?? 0,
    critMultiplier: raw.CritMultiplier ?? 1,
    statusChance: raw.StatusChance ?? 0,
    magazine: { ...(raw.Magazine ?? {}) },
    grips,
  }
}

const CLASS_SUFFIX = { primary: "(Primary)", secondary: "(Secondary)" } as const

function buildChambers(
  rawChambers: Record<string, RawChamber>,
  cls: keyof typeof CLASS_SUFFIX,
  wikiWeaponsByName: Map<string, Raw>,
): Record<string, ModularKitgunChamber> {
  const out: Record<string, ModularKitgunChamber> = {}
  for (const [family, raw] of Object.entries(rawChambers)) {
    // The catalog weapon entry for this chamber carries the attack-mode
    // structure (names + per-attack damage-type membership) we allocate over.
    const wikiName = `${family} ${CLASS_SUFFIX[cls]}`
    const wikiEntry = wikiWeaponsByName.get(wikiName)
    const wikiAttacks = (wikiEntry?.Attacks as Raw[] | undefined) ?? []
    if (wikiAttacks.length === 0) {
      // Without the catalog weapon's attack structure, allocateDamage emits a
      // synthetic "Normal Attack" whose name won't match the catalog item's
      // real attack modes — the web reconstructor then drops everything. Warn
      // so a family/name drift between the two wiki tables surfaces at build.
      console.warn(
        `[merge-modular] no catalog weapon "${wikiName}" (or it has no Attacks) — ${family} (${cls}) damage can't map to real attack modes`,
      )
    }
    out[family] = buildChamber(raw, wikiAttacks, wikiName)
  }
  return out
}

function buildLoaders(
  rawLoaders: Record<string, RawLoader>,
): ModularKitguns["loaders"] {
  const out: ModularKitguns["loaders"] = {}
  for (const [name, raw] of Object.entries(rawLoaders)) {
    out[name] = {
      critChance: raw.CritChance ?? 0,
      critMultiplier: raw.CritMultiplier ?? 0,
      statusChance: raw.StatusChance ?? 0,
      reload: raw.Reload ?? 0,
      magazine: raw.Magazine ?? "Med",
    }
  }
  return out
}

function buildZaws(zaw: Raw | undefined): ModularZaws {
  const strikes: ModularZaws["strikes"] = {}
  const grips: ModularZaws["grips"] = {}
  const links: ModularZaws["links"] = {}
  if (zaw) {
    for (const [name, s] of Object.entries(
      (zaw.Strike as Record<string, Raw>) ?? {},
    )) {
      const type = (s.Type as { OneHanded?: string; TwoHanded?: string }) ?? {}
      strikes[name] = {
        critChance: (s.CritChance as number) ?? 0,
        critMultiplier: (s.CritMultiplier as number) ?? 1,
        statusChance: (s.StatusChance as number) ?? 0,
        speed: (s.Speed as number) ?? 0,
        damage: lowerDamage(s.Damage as Record<string, unknown>),
        oneHanded: type.OneHanded ?? "",
        twoHanded: type.TwoHanded ?? "",
      }
    }
    for (const [name, g] of Object.entries(
      (zaw.Grip as Record<string, Raw>) ?? {},
    )) {
      grips[name] = {
        damage: (g.Damage as number) ?? 0,
        speed: (g.Speed as number) ?? 0,
        twoHanded: (g.Type as string) === "TwoHanded",
      }
    }
    for (const [name, l] of Object.entries(
      (zaw.Link as Record<string, Raw>) ?? {},
    )) {
      links[name] = {
        critChance: (l.CritChance as number) ?? 0,
        statusChance: (l.StatusChance as number) ?? 0,
        damage: (l.Damage as number) ?? 0,
        speed: (l.Speed as number) ?? 0,
      }
    }
  }
  return { strikes, grips, links }
}

/**
 * Translate the parsed `Module:Modular/data` table into the emitted
 * `ModularData` shape. `wikiWeaponsByName` supplies each kitgun chamber's
 * attack-mode structure for damage allocation.
 */
export function mergeModular(
  modular: Raw,
  wikiWeaponsByName: Map<string, Raw>,
): ModularData {
  const secondary = (modular.Kitgun as Raw | undefined) ?? {}
  const primary = (modular.KitgunPrimary as Raw | undefined) ?? {}

  return {
    kitgun: {
      primary: buildChambers(
        (primary.Chamber as Record<string, RawChamber>) ?? {},
        "primary",
        wikiWeaponsByName,
      ),
      secondary: buildChambers(
        (secondary.Chamber as Record<string, RawChamber>) ?? {},
        "secondary",
        wikiWeaponsByName,
      ),
      // Loaders are identical across both classes; emit once from primary.
      loaders: buildLoaders(
        (primary.Loader as Record<string, RawLoader>) ??
          (secondary.Loader as Record<string, RawLoader>) ??
          {},
      ),
    },
    zaw: buildZaws(modular.Zaw as Raw | undefined),
  }
}
