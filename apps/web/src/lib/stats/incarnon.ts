import {
  getIncarnonPerkDescription,
  type IncarnonEvolution,
} from "@arsenyx/shared/warframe/incarnon-data"

import type { SourcedStat } from "./parser"
import type { StatType } from "./types"

// Reads the stat lines out of Incarnon evolution perk text. Rules
// (wiki Incarnon Evolutions + per-weapon Genesis pages):
// - "+X Base …" raises the weapon's base value before mods (base_add).
// - Other "+X% …" lines stack additively with the matching mods (percent_add).
// - Critical multiplier "+Xx" is always base ("added as base critical damage").
// - Magazine, reload and range perks never affect the Incarnon Form.
// - "for Incarnon Form" applies only to the form; "per projectile" (the per-
//   pellet base value) only to the normal attacks.
// Situational lines ("On Kill:", "while sliding", "stacking") come back as
// conditional stats; anything not shown in the stats panel is skipped.

// Any condition word makes its whole sentence situational: a trailing
// condition can cover every clause, e.g. Paris's "+40% Base Critical Chance on
// undamaged enemies, +2x Base Critical Damage Multiplier" per the wiki.
const CONDITION =
  /\b(on|with|while|when|if|each|during|after|in|against|stacking)\b|\bfor \d/i
const CLAUSE =
  /^([+-]\d+(?:\.\d+)?)(%|x)? (base )?([a-z ]+?)( per projectile| for incarnon form)?$/i

const STATS: Record<string, StatType> = {
  damage: "damage",
  "critical chance": "critical_chance",
  "status chance": "status_chance",
  "critical damage multiplier": "critical_multiplier",
  "critical multiplier": "critical_multiplier",
  "magazine capacity": "magazine_size",
  "reload speed": "reload_speed",
  "fire rate": "fire_rate",
  "attack speed": "fire_rate",
  multishot: "multishot",
  range: "range",
}

type PerkStat = Omit<SourcedStat, "sourceName">

export function parseIncarnonPerkStats(description: string): PerkStat[] {
  const out: PerkStat[] = []
  // Soma's per-pellet base damage isn't modeled (no "per projectile" scope).
  const perPellet = /\bper pellet\b/i.test(description)
  const sentences = description
    // Variant notes like "(Braton)" — the description is already per-variant.
    .replace(/\s*\([^)]*\)/g, "")
    // Strun/Sybaris say "in Incarnon Form"; "in" would read as a condition.
    .replace(/\bin incarnon form\b/gi, "for Incarnon Form")
    .split(/(?<=\.)\s+|;\s*/)
  // A clause without a stat name ("+48% for Incarnon Form", "effect doubles
  // for Incarnon Form") continues the previous stat.
  let prev = null as PerkStat | null
  for (const sentence of sentences) {
    if (CONDITION.test(sentence)) {
      if (!perPellet) out.push(...parseSituational(sentence))
      prev = null
      continue
    }
    for (const raw of sentence.split(
      /,\s*(?=[+-]\d)|\s+and\s+(?=[+-]\d)|\s*\/\s*(?=[+-]\d)/,
    )) {
      const clause = raw.trim().replace(/\.$/, "")
      const formOnly = FORM_ONLY.exec(clause)
      const stat: PerkStat | null =
        prev && formOnly
          ? { ...prev, value: parseFloat(formOnly[1]), attackScope: "incarnon" }
          : prev && DOUBLES.test(clause)
            ? { ...prev, value: prev.value * 2, attackScope: "incarnon" }
            : parseClause(clause)
      if (stat) out.push(stat)
      prev = stat
    }
  }
  // A form-only value replaces the all-attacks one inside the form.
  for (const s of out) {
    if (
      !s.attackScope &&
      out.some((f) => f.attackScope === "incarnon" && f.type === s.type)
    )
      s.attackScope = "normal"
  }
  return out
}

// A situational sentence ("On Headshot: +7.5% Fire Rate for 4s, stacking up
// to 10x") yields conditional stats the "Max stacks" toggle applies at full
// stacks. Per the wiki their bonuses add like the always-on ones. "On Equip"
// buffs last a few seconds after a weapon swap, so they stay out.
const STACKS = /\bstack(?:s|ing)?(?: up to)? (\d+)(?:x| times)/i
const TRAILING_CONDITION =
  /\s+(?:on|with|while|when|if|against|during|per (?!projectile))\b.*$/i

function parseSituational(sentence: string): PerkStat[] {
  // Weakpoint-only crit (Sicarus King's Gambit) is per hit, not a state.
  if (/\bon equip\b|\bon weakpoint hits?\b/i.test(sentence)) return []
  const stacks = STACKS.exec(sentence)
  const maxStacks = stacks ? parseInt(stacks[1]) : undefined
  const body = sentence
    .replace(/^[^:+]*:\s*/, "")
    .replace(/,?\s*\bstack(?:s|ing)?\b.*$/i, "")
    .replace(/\s+for \d+(?:\.\d+)?\s*(?:s|seconds)\b/gi, "")
    .replace(/\badditional /gi, "")
  const out: PerkStat[] = []
  for (const raw of body.split(/,\s*(?=[+-]\d)|\s+and\s+(?=[+-]\d)/)) {
    const clause = raw.trim().replace(/\.$/, "").replace(TRAILING_CONDITION, "")
    const stat = parseClause(clause)
    if (stat)
      out.push({
        ...stat,
        isConditional: true,
        ...(maxStacks && { maxStacks }),
      })
  }
  return out
}

const FORM_ONLY = /^\+(\d+(?:\.\d+)?)[%x]? for incarnon form$/i
const DOUBLES = /^(?:effect )?doubles for incarnon form$/i

function parseClause(clause: string): PerkStat | null {
  const m = CLAUSE.exec(clause)
  if (!m) return null
  const [, num, unit = "", base, name, suffix] = m
  const type = STATS[name.toLowerCase()]
  if (!type) return null
  const value = parseFloat(num)

  let operation: SourcedStat["operation"]
  if (type === "critical_multiplier") {
    if (unit !== "x") return null
    operation = "base_add"
  } else if (base) {
    // Base chance is in percentage points; base damage/magazine are flat.
    const pointStat = type === "critical_chance" || type === "status_chance"
    if (unit !== (pointStat ? "%" : "")) return null
    if (type !== "damage" && type !== "magazine_size" && !pointStat) return null
    operation = "base_add"
  } else if (unit === "%" && type !== "damage" && type !== "range") {
    operation = "percent_add"
  } else if (unit === "" && type === "range") {
    operation = "flat_add"
  } else {
    // "+2 Multishot", "+14 Magazine Capacity": base-or-mod is undocumented.
    return null
  }

  const s = suffix?.trim().toLowerCase()
  const attackScope =
    s === "for incarnon form"
      ? "incarnon"
      : s === "per projectile" ||
          type === "magazine_size" ||
          type === "reload_speed" ||
          // Moonrise Velocity: "no effect on Incarnon Form" (wiki); no melee
          // weapon has an Incarnon Form attack mode, so Orokin Reach is unaffected.
          type === "range"
        ? "normal"
        : undefined
  return { type, value, operation, ...(attackScope && { attackScope }) }
}

// Situational perks the wiki says misbehave: Dual Toxocyst's "Currently does
// not work"; Despair's set bonus is mainly a multiplicative +100% Damage.
const BROKEN_SITUATIONAL: Record<string, string> = {
  "Dual Toxocyst": "Ready Retaliation",
  Despair: "Stalker's Vendetta",
}

/** Stats from the picked perks of an enabled Incarnon weapon. */
export function incarnonPerkStats(
  evolution: IncarnonEvolution,
  perks: (string | null)[],
  weaponName: string,
): SourcedStat[] {
  const out: SourcedStat[] = []
  for (const tier of evolution.tiers) {
    const picked = tier.perks.find((p) => p.name === perks[tier.tier - 1])
    if (!picked) continue
    for (const s of parseIncarnonPerkStats(
      getIncarnonPerkDescription(picked, weaponName),
    )) {
      if (s.isConditional && BROKEN_SITUATIONAL[weaponName] === picked.name)
        continue
      out.push({ ...s, sourceName: picked.name })
    }
  }
  return out
}
