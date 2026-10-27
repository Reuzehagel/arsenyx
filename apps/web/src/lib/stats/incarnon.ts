import {
  getIncarnonPerkDescription,
  type IncarnonEvolution,
} from "@arsenyx/shared/warframe/incarnon-data"

import type { SourcedStat } from "./parser"
import type { StatType } from "./types"

// Reads the always-on stat lines out of Incarnon evolution perk text. Rules
// (wiki Incarnon Evolutions + per-weapon Genesis pages):
// - "+X Base …" raises the weapon's base value before mods (base_add).
// - Other "+X% …" lines stack additively with the matching mods (percent_add).
// - Critical multiplier "+Xx" is always base ("added as base critical damage").
// - Magazine, reload and range perks never affect the Incarnon Form.
// - "for Incarnon Form" applies only to the form; "per projectile" (the per-
//   pellet base value) only to the normal attacks.
// Anything conditional ("On Kill:", "while aiming", "stacking") or not shown
// in the stats panel is skipped.

// Any condition word drops its whole sentence: a trailing condition can cover
// every clause, e.g. Paris's "+40% Base Critical Chance on undamaged enemies,
// +2x Base Critical Damage Multiplier" is all conditional per the wiki.
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
  const sentences = description
    // Variant notes like "(Braton)" — the description is already per-variant.
    .replace(/\s*\([^)]*\)/g, "")
    .split(/(?<=\.)\s+|;\s*/)
  for (const sentence of sentences) {
    if (CONDITION.test(sentence)) continue
    for (const raw of sentence.split(/,\s*(?=[+-]\d)|\s+and\s+(?=[+-]\d)/)) {
      const stat = parseClause(raw.trim().replace(/\.$/, ""))
      if (stat) out.push(stat)
    }
  }
  return out
}

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
      out.push({ ...s, sourceName: picked.name })
    }
  }
  return out
}
