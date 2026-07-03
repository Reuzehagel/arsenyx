/**
 * Translate wiki Lua `Attacks` arrays into the legacy-shaped
 * `attacks` + `damage` + `totalDamage` fields consumers expect.
 *
 * Wiki shape (one entry per attack mode):
 * ```lua
 * Attacks = {
 *   { AttackName="Normal Attack", FireRate=8.75, CritChance=0.12,
 *     CritMultiplier=1.6, StatusChance=0.06, ShotType="Hit-Scan",
 *     Damage = { Impact=7.92, Slash=8.16, Puncture=7.92 } },
 *   { AttackName="Incarnon Form", FireRate=5, CritChance=0.3, … },
 * }
 * ```
 *
 * Emitted shape (matches `apps/web/src/lib/warframe.ts` DetailItem):
 * ```ts
 * attacks: [{
 *   name: "Normal Attack",
 *   speed: 8.75,
 *   crit_chance: 12, crit_mult: 1.6, status_chance: 6,
 *   shot_type: "Hit-Scan",
 *   damage: { impact: 7.92, slash: 8.16, puncture: 7.92 },
 *   falloff?: { start, end, reduction },
 * }]
 * damage: { impact: 7.92, slash: 8.16, puncture: 7.92 }  // Normal Attack only
 * totalDamage: 24
 * ```
 *
 * Conventions:
 *   - Damage keys lowercased ("Impact" → "impact").
 *   - CritChance / StatusChance scaled to integer percent (0.12 → 12).
 *   - `weapon.damage` mirrors the Normal Attack damage only (legacy
 *     contract — other attack modes get pulled from `attacks[]`).
 *   - Per-attack damage dicts emit only nonzero keys (saves bytes;
 *     consumer iterates Object.entries either way).
 */

export interface AttackOut {
  name: string
  speed?: number
  crit_chance?: number
  crit_mult?: number
  status_chance?: number
  shot_type?: string
  trigger?: string
  multishot?: number
  range?: number
  punch_through?: number
  damage?: Record<string, number>
  falloff?: { start: number; end: number; reduction: number }
  charges?: number
}

export interface DamageOut {
  attacks?: AttackOut[]
  damage?: Record<string, number>
  totalDamage?: number
}

interface WikiAttack {
  AttackName?: string
  FireRate?: number
  CritChance?: number
  CritMultiplier?: number
  StatusChance?: number
  ShotType?: string
  Trigger?: string
  Multishot?: number
  Range?: number
  PunchThrough?: number
  IncarnonCharges?: number
  AmmoCost?: number
  Damage?: Record<string, unknown>
  Falloff?: { StartRange?: number; EndRange?: number; Reduction?: number }
}

function toPct(v: number | undefined): number | undefined {
  if (v === undefined) return undefined
  // Wiki ships ratios (0.12). Consumer normalizeRate accepts both, but
  // legacy emitted percent ints — keep that contract.
  return Math.round(v * 1000) / 10
}

export function lowerDamageKeys(
  d: Record<string, unknown> | undefined,
): Record<string, number> | undefined {
  if (!d) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(d)) {
    if (typeof v !== "number" || v === 0) continue
    out[k.toLowerCase()] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function buildAttack(a: WikiAttack): AttackOut {
  const out: AttackOut = { name: a.AttackName ?? "Normal Attack" }
  if (a.FireRate !== undefined) out.speed = a.FireRate
  const cc = toPct(a.CritChance)
  if (cc !== undefined) out.crit_chance = cc
  if (a.CritMultiplier !== undefined) out.crit_mult = a.CritMultiplier
  const sc = toPct(a.StatusChance)
  if (sc !== undefined) out.status_chance = sc
  if (a.ShotType) out.shot_type = a.ShotType
  if (a.Trigger) out.trigger = a.Trigger
  if (a.Multishot !== undefined && a.Multishot !== 1)
    out.multishot = a.Multishot
  if (a.Range !== undefined) out.range = a.Range
  if (a.PunchThrough !== undefined && a.PunchThrough > 0) {
    out.punch_through = a.PunchThrough
  }
  if (a.IncarnonCharges !== undefined) out.charges = a.IncarnonCharges
  const dmg = lowerDamageKeys(a.Damage)
  if (dmg) out.damage = dmg
  if (a.Falloff) {
    const f = a.Falloff
    if (
      f.StartRange !== undefined ||
      f.EndRange !== undefined ||
      f.Reduction !== undefined
    ) {
      out.falloff = {
        start: f.StartRange ?? 0,
        end: f.EndRange ?? 0,
        reduction: f.Reduction ?? 0,
      }
    }
  }
  return out
}

/**
 * Build the damage/attacks block from a wiki entry's `Attacks` array.
 * Returns `{}` (no fields) when the wiki has no attacks data — caller
 * can decide to fall back to DE's `damagePerShot[20]` array.
 */
export function buildDamageBlock(
  wikiAttacks: readonly WikiAttack[] | undefined,
): DamageOut {
  if (!wikiAttacks || wikiAttacks.length === 0) return {}
  const attacks = wikiAttacks.map(buildAttack)
  const out: DamageOut = { attacks }
  // Normal Attack damage seeds weapon.damage + totalDamage.
  const normal = attacks.find((a) => a.name === "Normal Attack") ?? attacks[0]
  if (normal?.damage) {
    out.damage = normal.damage
    out.totalDamage = Object.values(normal.damage).reduce((a, b) => a + b, 0)
  }
  return out
}

// ---------------------------------------------------------------------------
// Fallback: DE `damagePerShot[20]` → damage dict
// ---------------------------------------------------------------------------

/**
 * DE's `damagePerShot` is a 20-element array indexed by an internal
 * DT_* damage type enum. This table maps each index to the lowercase
 * element name the UI expects.
 */
const DT_INDEX: readonly string[] = [
  "impact", // 0
  "puncture", // 1
  "slash", // 2
  "heat", // 3
  "cold", // 4
  "electricity", // 5
  "toxin", // 6
  "blast", // 7
  "radiation", // 8
  "gas", // 9
  "magnetic", // 10
  "viral", // 11
  "corrosive", // 12
  "void", // 13
  "tau", // 14
  "cinematic", // 15
  "shielddrain", // 16
  "healthdrain", // 17
  "energydrain", // 18
  "finisher", // 19
]

/** Convert DE damagePerShot[20] → lowercase damage dict (nonzero only). */
export function damageFromDePerShot(
  arr: readonly number[] | undefined,
): Record<string, number> | undefined {
  if (!arr || arr.length === 0) return undefined
  const out: Record<string, number> = {}
  for (let i = 0; i < arr.length && i < DT_INDEX.length; i++) {
    const v = arr[i]!
    if (v !== 0) out[DT_INDEX[i]!] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}
