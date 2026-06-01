import type {
  Attack,
  DamageTypes,
  DeploymentContext,
  Gun,
  LichBonusElement,
  Melee,
  Weapon,
} from "@arsenyx/shared/warframe/types"

import { accumulate, round } from "./helpers"
import {
  collectSourcedStats,
  type PlacedArcaneInput,
  type PlacedModInput,
  type SourcedStat,
} from "./parser"
import {
  BASE_ELEMENTS,
  COMBINED_ELEMENTS,
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
  /**
   * Deployment context for arch-guns. When `"atmospheric"` and the weapon
   * carries `atmosphericDamage`/`atmosphericAttacks` overrides, those
   * replace the default Archwing-mission profile. Ignored for any weapon
   * without atmospheric overrides.
   */
  deploymentContext?: DeploymentContext
  /**
   * Kuva/Tenet progenitor bonus element. Adds a flat +60% of the chosen
   * element as if it were a mod stat, so it combines with mod elements
   * (e.g. Cold + bonus Toxin → Viral).
   */
  lichBonusElement?: LichBonusElement | null
}

const LICH_BONUS_PERCENT = 60

function lichBonusStat(element: LichBonusElement): SourcedStat {
  return {
    type: element.toLowerCase() as SourcedStat["type"],
    value: LICH_BONUS_PERCENT,
    operation: "percent_add",
    sourceName: "Bonus Element",
  }
}

export function calculateWeaponStats(input: WeaponCalcInput): WeaponStats {
  const weapon = applyDeploymentContext(input.weapon, input.deploymentContext)
  const stats = collectSourcedStats(input.mods, input.arcanes, {
    showMaxStacks: input.showMaxStacks,
  })
  if (input.lichBonusElement) {
    stats.push(lichBonusStat(input.lichBonusElement))
  }

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
          crit: ratioToPercent(weapon.criticalChance),
          critMult: weapon.criticalMultiplier,
          status: ratioToPercent(weapon.procChance),
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
            // Wiki per-attack crit/status are already percentages (e.g. 35 =
            // 35%, 1 = 1%); the DE weapon-level fallback is a 0–1 ratio.
            // Convert only the ratio — never multiply the wiki value, or a
            // sub-1% attack (Pox/Sporothrix at 1%) inflates to 100%.
            crit: attack.crit_chance ?? ratioToPercent(weapon.criticalChance),
            critMult: attack.crit_mult ?? weapon.criticalMultiplier,
            status: attack.status_chance ?? ratioToPercent(weapon.procChance),
            fireRate: attack.speed ?? weapon.fireRate,
          },
          weapon,
          stats,
        ),
      )
    }
  }

  return { attackModes, multishot }
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
  const { percent, flat, contributions } = accumulate(statType, stats)
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

  // Innate base-element damage scales with base-damage mods (Serration etc.)
  // and acts as the base for modded elementals on weapons with no physical
  // damage (e.g. Balefire Charger's pure-electricity shots). Include it in
  // totalModdedBase so elemental mod percentages have something to multiply.
  let innateElementalBase = 0
  for (const [type, value] of Object.entries(baseDamage)) {
    if (BASE_ELEMENTS.includes(type as DamageType) && value && value > 0) {
      innateElementalBase += value
    }
  }
  const totalModdedBase =
    physical.reduce((s, e) => s + e.value, 0) + innateElementalBase * baseMult

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

  // Innate base elements come LAST in the combination hierarchy: modded
  // elements combine with each other first, and the innate only combines
  // with whatever's left over. Encode as a percentage of totalModdedBase so
  // combineElements' shared `totalModdedBase * pct / 100` formula recovers
  // `value * baseMult`.
  for (const [type, value] of Object.entries(baseDamage)) {
    if (BASE_ELEMENTS.includes(type as DamageType) && value && value > 0) {
      const pctEquivalent =
        totalModdedBase > 0 ? ((value * baseMult) / totalModdedBase) * 100 : 0
      elementalMods.push({
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

  // Combined-element stats from mods/rivens/arcanes (e.g. a Riven rolling
  // +Magnetic Damage). These don't combine further, so emit them directly.
  const combinedByType = new Map<
    DamageType,
    { name: string; value: number }[]
  >()
  for (const s of stats) {
    if (s.operation !== "percent_add") continue
    if (!COMBINED_ELEMENTS.includes(s.type as DamageType)) continue
    const t = s.type as DamageType
    if (!combinedByType.has(t)) combinedByType.set(t, [])
    combinedByType.get(t)!.push({ name: s.sourceName, value: s.value })
  }
  for (const [type, sources] of combinedByType) {
    elemental.push(
      makeUncombinedEntry(type, sources, totalModdedBase, baseDamageContribs),
    )
  }

  // Innate combined elementals (e.g. innate Blast on some weapons).
  for (const [type, value] of Object.entries(baseDamage)) {
    if (COMBINED_ELEMENTS.includes(type as DamageType) && value && value > 0) {
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

  // Per wiki, mod-added elements combine pairwise in slot order. Innate
  // elements are resolved AFTER mods: they either contribute to a combination
  // already containing their type, or pair with a leftover uncombined mod
  // element to form a secondary, or remain standalone if neither fits.
  type Working = { entry: DamageEntry; sourceTypes: Set<DamageType> }
  const result: Working[] = []
  const moddedQueue = elements.filter((e) => !e.isInnate)
  const innates = elements.filter((e) => e.isInnate)

  while (moddedQueue.length > 0) {
    const first = moddedQueue.shift()!
    let combined = false
    for (let i = 0; i < moddedQueue.length; i++) {
      const second = moddedQueue[i]
      const combinedType =
        ELEMENTAL_COMBINATIONS[`${first.type}+${second.type}`]
      if (combinedType) {
        result.push({
          entry: makeCombinedEntry(
            combinedType,
            first,
            second,
            totalModdedBase,
            baseDamageContribs,
          ),
          sourceTypes: new Set([first.type, second.type]),
        })
        moddedQueue.splice(i, 1)
        combined = true
        break
      }
    }
    if (!combined) {
      result.push({
        entry: makeUncombinedEntry(
          first.type,
          first.sources,
          totalModdedBase,
          baseDamageContribs,
        ),
        sourceTypes: new Set([first.type]),
      })
    }
  }

  for (const innate of innates) {
    // 1. Fold into any existing entry whose source elements already include
    //    this type — covers both "contributes to established combination"
    //    (e.g. innate Electricity into mod-made Magnetic) and "same-type
    //    leftover" (innate Cold + lone modded Cold).
    const sharing = result.find((r) => r.sourceTypes.has(innate.type))
    if (sharing) {
      const added = (totalModdedBase * innate.value) / 100
      sharing.entry.value = round1(sharing.entry.value + added)
      for (const src of innate.sources) {
        sharing.entry.contributions.push({
          name: src.name,
          amount: src.value,
          operation: "percent_add",
          group: DAMAGE_TYPE_LABELS[innate.type],
        })
      }
      continue
    }

    // 2. Pair with a leftover uncombined base-element entry to form a
    //    secondary element (e.g. innate Cold + leftover modded Toxin → Viral).
    const partnerIdx = result.findIndex(
      (r) =>
        r.sourceTypes.size === 1 &&
        BASE_ELEMENTS.includes(r.entry.type) &&
        ELEMENTAL_COMBINATIONS[`${innate.type}+${r.entry.type}`],
    )
    if (partnerIdx !== -1) {
      const partner = result[partnerIdx]
      const partnerType = partner.entry.type
      const combinedType =
        ELEMENTAL_COMBINATIONS[`${innate.type}+${partnerType}`]!
      const added = (totalModdedBase * innate.value) / 100
      const newContribs: StatContribution[] = [...partner.entry.contributions]
      for (const src of innate.sources) {
        newContribs.push({
          name: src.name,
          amount: src.value,
          operation: "percent_add",
          group: DAMAGE_TYPE_LABELS[innate.type],
        })
      }
      result[partnerIdx] = {
        entry: {
          type: combinedType,
          value: round1(partner.entry.value + added),
          base: 0,
          contributions: newContribs,
        },
        sourceTypes: new Set([partnerType, innate.type]),
      }
      continue
    }

    // 3. No fit — emit as standalone (innate Heat with no compatible mods).
    result.push({
      entry: makeUncombinedEntry(
        innate.type,
        innate.sources,
        totalModdedBase,
        baseDamageContribs,
      ),
      sourceTypes: new Set([innate.type]),
    })
  }

  return result.map((r) => r.entry)
}

function makeCombinedEntry(
  combinedType: DamageType,
  first: {
    type: DamageType
    value: number
    sources: { name: string; value: number }[]
  },
  second: {
    type: DamageType
    value: number
    sources: { name: string; value: number }[]
  },
  totalModdedBase: number,
  baseDamageContribs: StatContribution[],
): DamageEntry {
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
  return {
    type: combinedType,
    value: round1(value),
    base: 0,
    contributions: contribs,
  }
}

function makeUncombinedEntry(
  type: DamageType,
  sources: { name: string; value: number }[],
  totalModdedBase: number,
  baseDamageContribs: StatContribution[],
): DamageEntry {
  const sum = sources.reduce((t, s) => t + s.value, 0)
  const value = (totalModdedBase * sum) / 100
  const contribs: StatContribution[] = [...baseDamageContribs]
  for (const src of sources) {
    contribs.push({
      name: src.name,
      amount: src.value,
      operation: "percent_add",
      group: DAMAGE_TYPE_LABELS[type],
    })
  }
  return { type, value: round1(value), base: 0, contributions: contribs }
}

export function sumDamage(d: DamageTypes): number {
  let sum = 0
  for (const v of Object.values(d)) sum += v ?? 0
  return sum
}

interface AtmosphericVariant {
  atmosphericDamage?: DamageTypes
  atmosphericTotalDamage?: number
  atmosphericAttacks?: Attack[]
}

function applyDeploymentContext<T extends Gun | Melee | Weapon>(
  weapon: T,
  context: DeploymentContext | undefined,
): T {
  if (context !== "atmospheric") return weapon
  const variant = weapon as T & AtmosphericVariant
  if (!variant.atmosphericDamage && !variant.atmosphericAttacks) return weapon
  return {
    ...weapon,
    damage: variant.atmosphericDamage ?? weapon.damage,
    totalDamage: variant.atmosphericTotalDamage ?? weapon.totalDamage,
    attacks: variant.atmosphericAttacks ?? weapon.attacks,
  }
}

/** DE stores crit chance / status chance as a 0–1 ratio; the UI shows a
 *  percentage. Wiki per-attack values are already percentages and must NOT
 *  pass through here. */
function ratioToPercent(v: number | undefined): number {
  return (v ?? 0) * 100
}

const round1 = (v: number) => round(v, 1)
