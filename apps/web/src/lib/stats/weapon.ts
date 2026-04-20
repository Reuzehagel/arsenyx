import type {
  DamageTypes,
  Gun,
  Melee,
  Weapon,
} from "@arsenyx/shared/warframe/types"

import { round } from "./helpers"
import {
  collectSourcedStats,
  type PlacedArcaneInput,
  type PlacedModInput,
  type SourcedStat,
} from "./parser"
import {
  BASE_ELEMENTS,
  DAMAGE_TYPE_LABELS,
  ELEMENTAL_COMBINATIONS,
  type AttackModeStats,
  type DamageBreakdown,
  type DamageEntry,
  type DamageType,
  type StatContribution,
  type StatType,
  type StatValue,
  type WeaponStats,
} from "./types"

export interface WeaponCalcInput {
  weapon: Gun | Melee | Weapon
  mods: PlacedModInput[]
  arcanes: PlacedArcaneInput[]
  showMaxStacks?: boolean
}

export function calculateWeaponStats(input: WeaponCalcInput): WeaponStats {
  const { weapon } = input
  const stats = collectSourcedStats(input.mods, input.arcanes, {
    showMaxStacks: input.showMaxStacks,
  })

  const multishot = calcStat("multishot", 1, stats)
  const hasAttacks = Boolean(weapon.attacks && weapon.attacks.length > 0)
  const attackModes: AttackModeStats[] = []

  if (!hasAttacks && (weapon.totalDamage || weapon.damage)) {
    attackModes.push(
      buildAttackMode(
        {
          name: "Normal Attack",
          damage: weapon.damage,
          totalDamage: weapon.totalDamage,
          crit: weapon.criticalChance,
          critMult: weapon.criticalMultiplier,
          status: weapon.procChance,
          fireRate: weapon.fireRate,
        },
        weapon,
        stats,
      ),
    )
  }

  if (hasAttacks) {
    for (const attack of weapon.attacks!) {
      if (attack.name === "Normal Attack" && attackModes.length > 0) continue
      const damage =
        typeof attack.damage === "object" ? (attack.damage ?? {}) : {}
      const totalDamage = sumDamage(damage)
      attackModes.push(
        buildAttackMode(
          {
            name: attack.name,
            damage,
            totalDamage,
            crit: normalizeRate(attack.crit_chance ?? weapon.criticalChance),
            critMult: attack.crit_mult ?? weapon.criticalMultiplier,
            status: normalizeRate(attack.status_chance ?? weapon.procChance),
            fireRate: attack.speed ?? weapon.fireRate,
          },
          weapon,
          stats,
        ),
      )
    }
  }

  const grandTotalDamage = calcGrandTotal(attackModes, multishot, stats)

  return { attackModes, multishot, grandTotalDamage }
}

function calcGrandTotal(
  modes: AttackModeStats[],
  multishot: StatValue,
  stats: SourcedStat[],
): StatValue {
  const baseSum = modes.reduce((s, m) => s + m.totalDamage.base, 0)
  const modifiedSum = modes.reduce(
    (s, m) => s + m.totalDamage.modified * multishot.modified,
    0,
  )

  // Merge per-mode contributions (deduped by group+name+op) then append
  // multishot mods so the user can see every mod that fed the grand total.
  const seen = new Set<string>()
  const contributions: StatContribution[] = []
  for (const mode of modes) {
    for (const c of mode.totalDamage.contributions) {
      const key = `${c.group ?? ""}|${c.name}|${c.operation}`
      if (seen.has(key)) continue
      seen.add(key)
      contributions.push(c)
    }
  }
  for (const s of stats) {
    if (s.type === "multishot" && s.operation === "percent_add") {
      contributions.push({
        name: s.sourceName,
        amount: s.value,
        operation: "percent_add",
        group: "Multishot",
      })
    }
  }

  return {
    base: round(baseSum, 1),
    modified: round(modifiedSum, 1),
    contributions,
  }
}

interface AttackSource {
  name: string
  damage?: DamageTypes | string
  totalDamage?: number
  crit?: number
  critMult?: number
  status?: number
  fireRate?: number
}

function buildAttackMode(
  src: AttackSource,
  weapon: Gun | Melee | Weapon,
  stats: SourcedStat[],
): AttackModeStats {
  const baseDamage = src.totalDamage ?? 0
  const baseCritPct = src.crit ?? 0
  const baseCritMult = src.critMult ?? 1
  const baseStatusPct = src.status ?? 0
  const baseFireRate = src.fireRate ?? 1

  const damage =
    typeof src.damage === "object" && src.damage
      ? (src.damage as DamageTypes)
      : (weapon.damage ?? {})

  const breakdown = calcDamageBreakdown(damage, stats)
  const mode: AttackModeStats = {
    name: src.name,
    totalDamage: totalDamageFromBreakdown(baseDamage, damage, breakdown),
    criticalChance: calcStat("critical_chance", baseCritPct, stats),
    criticalMultiplier: calcStat("critical_multiplier", baseCritMult, stats, 2),
    statusChance: calcStat("status_chance", baseStatusPct, stats),
    fireRate: calcStat("fire_rate", baseFireRate, stats, 2),
    damageBreakdown: breakdown,
  }

  const gun = weapon as Gun
  if (gun.magazineSize) {
    mode.magazineSize = calcStat("magazine_size", gun.magazineSize, stats, 0)
  }
  if (gun.reloadTime) {
    mode.reloadTime = calcReloadTime(gun.reloadTime, stats)
  }

  const melee = weapon as Melee
  if (melee.range) {
    mode.range = calcStat("range", melee.range, stats, 2)
  }

  return mode
}

function calcStat(
  statType: StatType,
  base: number,
  stats: SourcedStat[],
  digits = 2,
): StatValue {
  const contributions: StatContribution[] = []
  let percent = 0
  let flat = 0
  for (const s of stats) {
    if (s.type !== statType) continue
    if (s.operation === "percent_add") {
      percent += s.value
      contributions.push({
        name: s.sourceName,
        amount: s.value,
        operation: "percent_add",
      })
    } else if (s.operation === "flat_add") {
      flat += s.value
      contributions.push({
        name: s.sourceName,
        amount: s.value,
        operation: "flat_add",
      })
    }
  }
  const modified = base * (1 + percent / 100) + flat
  return {
    base: round(base, digits),
    modified: round(modified, digits),
    contributions,
  }
}

function totalDamageFromBreakdown(
  rawBase: number,
  damage: DamageTypes,
  breakdown: DamageBreakdown,
): StatValue {
  // Raw base = sum of all damage-type values on the weapon (pre-mod).
  let base = rawBase
  if (!base) {
    base = Object.values(damage).reduce<number>((s, v) => s + (v ?? 0), 0)
  }

  const modified = [...breakdown.physical, ...breakdown.elemental].reduce(
    (s, e) => s + e.value,
    0,
  )

  // Dedupe contributions by (name, group). Within a weapon calc the same
  // mod contributes the same value to every damage row, so collapsing is
  // safe and accurately reflects what fed the total.
  const seen = new Set<string>()
  const contributions: StatContribution[] = []
  for (const entry of [...breakdown.physical, ...breakdown.elemental]) {
    for (const c of entry.contributions) {
      const key = `${c.group ?? ""}|${c.name}|${c.operation}`
      if (seen.has(key)) continue
      seen.add(key)
      contributions.push(c)
    }
  }

  return {
    base: round(base, 1),
    modified: round(modified, 1),
    contributions,
  }
}

function calcReloadTime(base: number, stats: SourcedStat[]): StatValue {
  // Reload Speed % reduces reload *time*. modified = base / (1 + Σ%)
  const contributions: StatContribution[] = []
  let percent = 0
  for (const s of stats) {
    if (s.type !== "reload_speed" || s.operation !== "percent_add") continue
    percent += s.value
    contributions.push({
      name: s.sourceName,
      amount: s.value,
      operation: "percent_add",
    })
  }
  const modified = base / (1 + percent / 100)
  return { base: round(base, 2), modified: round(modified, 2), contributions }
}

function calcDamageBreakdown(
  baseDamage: DamageTypes,
  stats: SourcedStat[],
): DamageBreakdown {
  // Base-damage (Serration-style) multiplier + its contributors.
  let baseMult = 1
  const baseDamageContribs: StatContribution[] = []
  for (const s of stats) {
    if (s.type === "damage" && s.operation === "percent_add") {
      baseMult += s.value / 100
      baseDamageContribs.push({
        name: s.sourceName,
        amount: s.value,
        operation: "percent_add",
        group: "Base Damage",
      })
    }
  }

  const physical: DamageEntry[] = []
  const makePhysical = (
    type: "impact" | "puncture" | "slash",
    base: number,
  ) => {
    const typeMult = physicalMult(type, stats)
    const value = base * baseMult * typeMult
    const contribs: StatContribution[] = [...baseDamageContribs]
    for (const s of stats) {
      if (s.type === type && s.operation === "percent_add") {
        contribs.push({
          name: s.sourceName,
          amount: s.value,
          operation: "percent_add",
          group: DAMAGE_TYPE_LABELS[type],
        })
      }
    }
    physical.push({
      type,
      value: round1(value),
      base: round1(base),
      contributions: contribs,
    })
  }
  if (baseDamage.impact) makePhysical("impact", baseDamage.impact)
  if (baseDamage.puncture) makePhysical("puncture", baseDamage.puncture)
  if (baseDamage.slash) makePhysical("slash", baseDamage.slash)

  const totalModdedBase = physical.reduce((s, e) => s + e.value, 0)

  // Collect elemental mods grouped by type, preserving source attribution.
  const elementalMods: {
    type: DamageType
    value: number
    sources: { name: string; value: number }[]
    isInnate?: boolean
  }[] = []

  // Modded elements (later in slot order).
  const byType = new Map<DamageType, { name: string; value: number }[]>()
  for (const s of stats) {
    if (
      BASE_ELEMENTS.includes(s.type as DamageType) &&
      s.operation === "percent_add"
    ) {
      const type = s.type as DamageType
      if (!byType.has(type)) byType.set(type, [])
      byType.get(type)!.push({ name: s.sourceName, value: s.value })
    }
  }
  for (const [type, sources] of byType) {
    const sum = sources.reduce((t, c) => t + c.value, 0)
    elementalMods.push({ type, value: sum, sources })
  }

  // Innate base elements come FIRST in the combination order.
  for (const [type, value] of Object.entries(baseDamage)) {
    if (BASE_ELEMENTS.includes(type as DamageType) && value && value > 0) {
      const pctEquivalent = (value / (totalModdedBase || 1)) * 100
      elementalMods.unshift({
        type: type as DamageType,
        value: pctEquivalent,
        sources: [{ name: "Innate", value: pctEquivalent }],
        isInnate: true,
      })
    }
  }

  const elemental = combineElements(
    elementalMods,
    totalModdedBase,
    baseDamageContribs,
  )

  // Innate combined elementals (e.g. innate Blast on some weapons).
  for (const [type, value] of Object.entries(baseDamage)) {
    if (
      (type as DamageType) !== "impact" &&
      (type as DamageType) !== "puncture" &&
      (type as DamageType) !== "slash" &&
      !BASE_ELEMENTS.includes(type as DamageType) &&
      value &&
      value > 0
    ) {
      const contribs: StatContribution[] = [...baseDamageContribs]
      contribs.unshift({
        name: "Innate",
        amount: value,
        operation: "flat_add",
        group: DAMAGE_TYPE_LABELS[type as DamageType],
      })
      elemental.push({
        type: type as DamageType,
        value: round1(value * baseMult),
        base: value,
        contributions: contribs,
      })
    }
  }

  return { physical, elemental }
}

function physicalMult(
  type: "impact" | "puncture" | "slash",
  stats: SourcedStat[],
): number {
  let m = 1
  for (const s of stats) {
    if (s.type === type && s.operation === "percent_add") {
      m += s.value / 100
    }
  }
  return m
}

function combineElements(
  elements: {
    type: DamageType
    value: number
    sources: { name: string; value: number }[]
    isInnate?: boolean
  }[],
  totalModdedBase: number,
  baseDamageContribs: StatContribution[],
): DamageEntry[] {
  if (elements.length === 0) return []
  const result: DamageEntry[] = []
  const remaining = [...elements]

  while (remaining.length > 0) {
    const first = remaining.shift()!
    let combined = false
    for (let i = 0; i < remaining.length; i++) {
      const second = remaining[i]
      const combinedType =
        ELEMENTAL_COMBINATIONS[`${first.type}+${second.type}`]
      if (combinedType) {
        const totalPct = first.value + second.value
        const value = (totalModdedBase * totalPct) / 100
        const contribs: StatContribution[] = [...baseDamageContribs]
        for (const src of first.sources) {
          contribs.push({
            name: src.name,
            amount: src.value,
            operation: "percent_add",
            group: DAMAGE_TYPE_LABELS[first.type],
          })
        }
        for (const src of second.sources) {
          contribs.push({
            name: src.name,
            amount: src.value,
            operation: "percent_add",
            group: DAMAGE_TYPE_LABELS[second.type],
          })
        }
        result.push({
          type: combinedType,
          value: round1(value),
          base: 0,
          contributions: contribs,
        })
        remaining.splice(i, 1)
        combined = true
        break
      }
    }
    if (!combined) {
      const value = (totalModdedBase * first.value) / 100
      const contribs: StatContribution[] = [...baseDamageContribs]
      for (const src of first.sources) {
        contribs.push({
          name: src.name,
          amount: src.value,
          operation: "percent_add",
          group: DAMAGE_TYPE_LABELS[first.type],
        })
      }
      result.push({
        type: first.type,
        value: round1(value),
        base: 0,
        contributions: contribs,
      })
    }
  }

  return result
}

export function sumDamage(d: DamageTypes): number {
  let sum = 0
  for (const v of Object.values(d)) sum += v ?? 0
  return sum
}

function normalizeRate(v: number | undefined): number {
  if (v === undefined) return 0
  return v > 1 ? v : v * 100
}

const round1 = (v: number) => round(v, 1)
