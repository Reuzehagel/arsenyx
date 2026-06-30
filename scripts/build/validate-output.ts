/**
 * Build-output gate — runs after every merge phase and BEFORE the write
 * phase wipes apps/web/public/data/, so a failing build leaves the last
 * good catalog on disk untouched.
 *
 * Two layers:
 *
 *   1. **Shape validation** — every emitted record gets a cheap structural
 *      check against the fields the web app dereferences without guards
 *      (the loaders are typed but do no runtime validation, so a drifted
 *      upstream field would otherwise surface as a component-level
 *      TypeError in production).
 *
 *   2. **Count regression** — compares item/mod/arcane totals (and
 *      per-category counts) against the previous build's meta.json. Game
 *      data only ever grows or shrinks by a handful of entries per update;
 *      a large drop means an upstream schema change or a broken merge
 *      silently discarding records, not a real removal. Override with
 *      ARSENYX_ALLOW_SHRINK=1 when a big drop is intentional.
 */

/** A drop is a regression when it exceeds BOTH bounds — small absolute
 *  removals (vaulting, dedup fixes) and tiny relative wobble stay legal. */
const MAX_DROP_FRACTION = 0.02
const MAX_DROP_ABSOLUTE = 5

export interface ValidationIssue {
  where: string
  msg: string
}

interface CountedMeta {
  itemCount?: number
  modCount?: number
  arcaneCount?: number
  perCategory?: Record<string, number>
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0
}

/** Fields the browse pages dereference unguarded on every BrowseItem. */
export function validateBrowseItems(
  byCategory: Record<string, Array<Record<string, unknown>>>,
  issues: ValidationIssue[],
): void {
  for (const [cat, items] of Object.entries(byCategory)) {
    const seenSlugs = new Set<string>()
    for (const it of items) {
      const where = `items-index.json ${cat}/${String(it["slug"] ?? it["name"] ?? "?")}`
      for (const field of ["uniqueName", "name", "slug"]) {
        if (!isNonEmptyString(it[field])) {
          issues.push({ where, msg: `missing/empty ${field}` })
        }
      }
      const slug = it["slug"]
      if (isNonEmptyString(slug)) {
        if (seenSlugs.has(slug)) {
          issues.push({ where, msg: `duplicate slug in ${cat}` })
        }
        seenSlugs.add(slug)
      }
    }
  }
}

/** Fields the mod picker / cards / conflict graph dereference unguarded. */
export function validateMods(
  mods: Array<Record<string, unknown>>,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>()
  for (const m of mods) {
    const where = `mods-all.json ${String(m["name"] ?? m["uniqueName"] ?? "?")}`
    for (const field of ["uniqueName", "name", "polarity", "rarity"]) {
      if (!isNonEmptyString(m[field])) {
        issues.push({ where, msg: `missing/empty ${field}` })
      }
    }
    for (const field of ["baseDrain", "fusionLimit"]) {
      if (typeof m[field] !== "number" || Number.isNaN(m[field])) {
        issues.push({ where, msg: `${field} is not a number` })
      }
    }
    const uniqueName = m["uniqueName"]
    if (isNonEmptyString(uniqueName)) {
      if (seen.has(uniqueName)) {
        issues.push({ where, msg: "duplicate uniqueName" })
      }
      seen.add(uniqueName)
    }
    const levelStats = m["levelStats"]
    if (levelStats !== undefined) {
      if (!Array.isArray(levelStats)) {
        issues.push({ where, msg: "levelStats is not an array" })
      } else {
        for (const tier of levelStats) {
          const stats = (tier as Record<string, unknown>)?.["stats"]
          if (
            !Array.isArray(stats) ||
            stats.some((s) => typeof s !== "string")
          ) {
            issues.push({ where, msg: "levelStats tier without stats[]" })
            break
          }
        }
      }
    }
    // The set-bonus card renders modSetStats[n-1] keyed off modSet — one
    // without the other means the ExportModSet join drifted.
    if ((m["modSetStats"] !== undefined) !== (m["modSet"] !== undefined)) {
      issues.push({
        where,
        msg: "modSet/modSetStats present without the other",
      })
    }
  }
}

export function validateArcanes(
  arcanes: Array<Record<string, unknown>>,
  issues: ValidationIssue[],
): void {
  for (const a of arcanes) {
    const where = `arcanes-all.json ${String(a["name"] ?? a["uniqueName"] ?? "?")}`
    for (const field of ["uniqueName", "name"]) {
      if (!isNonEmptyString(a[field])) {
        issues.push({ where, msg: `missing/empty ${field}` })
      }
    }
  }
}

function checkDrop(
  label: string,
  prev: number | undefined,
  next: number,
  issues: ValidationIssue[],
): void {
  if (prev === undefined || prev <= 0) return
  const drop = prev - next
  if (drop > MAX_DROP_ABSOLUTE && drop / prev > MAX_DROP_FRACTION) {
    issues.push({
      where: "meta.json",
      msg: `${label} dropped ${prev} → ${next} (−${drop}); a real game update removes a handful of entries, not this many — likely upstream drift or a broken merge. Set ARSENYX_ALLOW_SHRINK=1 if intentional.`,
    })
  }
}

/** Compare this build's counts against the previous build's meta.json
 *  (absent fields — first run after this gate landed — are skipped). */
export function validateCounts(
  prevMeta: CountedMeta | undefined,
  next: Required<CountedMeta>,
  issues: ValidationIssue[],
): void {
  if (!prevMeta) return
  checkDrop("itemCount", prevMeta.itemCount, next.itemCount, issues)
  checkDrop("modCount", prevMeta.modCount, next.modCount, issues)
  checkDrop("arcaneCount", prevMeta.arcaneCount, next.arcaneCount, issues)
  for (const [cat, prevCount] of Object.entries(prevMeta.perCategory ?? {})) {
    checkDrop(
      `perCategory.${cat}`,
      prevCount,
      next.perCategory[cat] ?? 0,
      issues,
    )
  }
}

export function validateOutputs(opts: {
  byCategory: Record<string, Array<Record<string, unknown>>>
  mods: Array<Record<string, unknown>>
  arcanes: Array<Record<string, unknown>>
  prevMeta: CountedMeta | undefined
  nextCounts: Required<CountedMeta>
}): void {
  const issues: ValidationIssue[] = []
  validateBrowseItems(opts.byCategory, issues)
  validateMods(opts.mods, issues)
  validateArcanes(opts.arcanes, issues)
  if (process.env["ARSENYX_ALLOW_SHRINK"] !== "1") {
    validateCounts(opts.prevMeta, opts.nextCounts, issues)
  }
  if (issues.length > 0) {
    const list = issues
      .slice(0, 50)
      .map((i) => `  - [${i.where}] ${i.msg}`)
      .join("\n")
    const more =
      issues.length > 50 ? `\n  … and ${issues.length - 50} more` : ""
    throw new Error(
      `Catalog validation failed (${issues.length} issue${issues.length === 1 ? "" : "s"}) — nothing was written, the previous catalog is untouched:\n${list}${more}`,
    )
  }
}
