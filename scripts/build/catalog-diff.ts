/**
 * Markdown summary of a catalog change, for the weekly data PR body. The item
 * files are single-line minified JSON, so GitHub's diff can't show what moved;
 * this reports it per field and per record instead. CLI: scripts/catalog-diff.ts.
 */

type Json = unknown
type Rec = Record<string, Json>

/** One catalog file, path relative to apps/web/public/data. */
export interface FileChange {
  path: string
  before?: Json
  after?: Json
}

const LIST_CAP = 20
const VALUE_CAP = 80

const isRec = (v: Json): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b)
const isRecordList = (v: Json): v is Rec[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((r) => isRec(r) && typeof r.uniqueName === "string")
const nameOf = (r: Rec) => String(r.name ?? r.uniqueName)

function show(v: Json): string {
  const s = v === undefined ? "(none)" : JSON.stringify(v)
  return s.length > VALUE_CAP ? `${s.slice(0, VALUE_CAP)}…` : s
}

function capped(names: string[]): string {
  const head = names.slice(0, LIST_CAP).join(", ")
  return names.length > LIST_CAP
    ? `${head}, … and ${names.length - LIST_CAP} more`
    : head
}

/** Added/removed/changed records of two uniqueName-keyed lists, by name. */
function diffRecords(before: Rec[], after: Rec[]) {
  const b = new Map(before.map((r) => [r.uniqueName as string, r]))
  const a = new Map(after.map((r) => [r.uniqueName as string, r]))
  return {
    added: [...a.values()].filter((r) => !b.has(r.uniqueName as string)),
    removed: [...b.values()].filter((r) => !a.has(r.uniqueName as string)),
    changed: [...a.values()].filter((r) => {
      const old = b.get(r.uniqueName as string)
      return old !== undefined && !same(old, r)
    }),
  }
}

export function summarizeCatalogDiff(changes: FileChange[]): string {
  const out: string[] = []
  const fields = new Map<string, { count: number; sample: string }>()
  const other: string[] = []

  for (const { path, before, after } of changes) {
    if (path === "meta.json" || same(before, after)) continue

    if (path === "items-index.json" && isRec(before) && isRec(after)) {
      const rows: string[] = []
      for (const cat of new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ])) {
        const d = diffRecords(
          (before[cat] as Rec[] | undefined) ?? [],
          (after[cat] as Rec[] | undefined) ?? [],
        )
        if (d.added.length)
          rows.push(`- **${cat}** added: ${capped(d.added.map(nameOf))}`)
        if (d.removed.length)
          rows.push(`- **${cat}** removed: ${capped(d.removed.map(nameOf))}`)
      }
      if (rows.length) out.push("### Items added / removed", ...rows, "")
      continue
    }

    if (path.startsWith("items/")) {
      // New/deleted item files are already listed via items-index.json.
      if (!isRec(before) || !isRec(after)) continue
      for (const k of new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ])) {
        if (same(before[k], after[k])) continue
        const f = fields.get(k)
        if (f) f.count++
        else
          fields.set(k, {
            count: 1,
            sample: `${nameOf(after)}: ${show(before[k])} → ${show(after[k])}`,
          })
      }
      continue
    }

    if (path === "_report.json" && isRec(before) && isRec(after)) {
      // Only arrays that grew: new unmatched/drift entries need curation.
      const rows: string[] = []
      for (const [k, v] of Object.entries(after)) {
        if (!Array.isArray(v)) continue
        const old = Array.isArray(before[k]) ? (before[k] as Json[]) : []
        const fresh = v.filter((x) => !old.some((o) => same(o, x)))
        if (fresh.length)
          rows.push(
            `- **${k}** +${fresh.length}: ${capped(fresh.map((x) => (typeof x === "string" ? x : show(x))))}`,
          )
      }
      if (rows.length)
        out.push("### New build-report entries (`_report.json`)", ...rows, "")
      continue
    }

    if (isRecordList(before) && isRecordList(after)) {
      const d = diffRecords(before, after)
      const rows = [
        d.added.length &&
          `- added ${d.added.length}: ${capped(d.added.map(nameOf))}`,
        d.removed.length &&
          `- removed ${d.removed.length}: ${capped(d.removed.map(nameOf))}`,
        d.changed.length &&
          `- changed ${d.changed.length}: ${capped(d.changed.map(nameOf))}`,
      ].filter((r): r is string => typeof r === "string")
      if (rows.length) out.push(`### \`${path}\``, ...rows, "")
      continue
    }

    other.push(`\`${path}\``)
  }

  if (fields.size) {
    out.push(
      "### Item fields changed",
      "| Field | Items | Example |",
      "| --- | ---: | --- |",
      ...[...fields]
        .sort((x, y) => y[1].count - x[1].count)
        // Pipes would split the table cell.
        .map(
          ([k, f]) =>
            `| \`${k}\` | ${f.count} | ${f.sample.replaceAll("|", "\\|")} |`,
        ),
      "",
    )
  }
  if (other.length) out.push("### Other files changed", capped(other), "")

  return out.length ? out.join("\n").trimEnd() : "No catalog changes."
}
