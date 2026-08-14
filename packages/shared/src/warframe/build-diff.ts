/**
 * Structural diff between two persisted build documents (`Build.buildData`).
 *
 * Runs server-side inside the PATCH that writes the new document, where both
 * the old and new versions are already in hand, and the result is stored on
 * BuildRevision.changes. It is a *description*, not a patch — nothing here can
 * reconstruct a build, and it deliberately can't: full snapshots run 5-80 KB
 * per revision, a change list runs a few hundred bytes.
 *
 * The input is untrusted JSON out of Postgres written by any past version of
 * the client, so every read here is defensive. An unreadable document yields
 * a single "Updated" line rather than throwing — a history entry that says
 * little beats a save that 500s.
 *
 * Deliberately NOT diffed slot-by-slot: a mod moved between two slots is not a
 * change anyone wants to read about, so adds and removes of the same name
 * inside one variant cancel out (see `cancelMoves`).
 */

export type BuildChangeOp = "add" | "remove" | "modify" | "info"

export interface BuildChange {
  op: BuildChangeOp
  /** Variant label the change belongs to. Absent for build-wide changes. A
   *  build carries up to MAX_VARIANTS loadouts, so an unscoped "+ Overextended"
   *  doesn't say enough to act on. */
  scope?: string
  label: string
  detail?: string
}

/** Hard cap on stored changes. A mass edit (paste-over-import, a rebuilt
 *  loadout) can touch everything at once; past this the list stops being read
 *  and starts being a JSON column that grows without bound. */
export const MAX_CHANGES = 40

// ---------------------------------------------------------------------------
// Defensive readers over the persisted shape (apps/web SavedBuildData). That
// type lives in apps/web and can't be imported here (api must not reach into
// web), so this module reads the subset it needs structurally.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>

function obj(v: unknown): Json | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Json)
    : null
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** A placed thing reduced to what the log shows: a name and a rank. */
interface Placed {
  name: string
  rank: number | null
}

function placedMod(v: unknown): Placed | null {
  const o = obj(v)
  if (!o) return null
  const name = str(obj(o.mod)?.name)
  return name ? { name, rank: num(o.rank) } : null
}

function placedArcane(v: unknown): Placed | null {
  const o = obj(v)
  if (!o) return null
  const name = str(o.name)
  return name ? { name, rank: num(o.rank) } : null
}

interface Variant {
  key: string
  label: string
  mods: Placed[]
  arcanes: Placed[]
  shards: string[]
  helminth: string[]
  guide: string
  incarnon: string
}

/** Stable identity for a shard/perk slot so counting differences doesn't
 *  depend on object key order. */
function stamp(v: unknown): string {
  const o = obj(v)
  if (!o) return v == null ? "" : String(v)
  return Object.keys(o)
    .sort()
    .map((k) => `${k}=${String(o[k])}`)
    .join(",")
}

function helminthNames(v: unknown): string[] {
  const o = obj(v)
  if (!o) return []
  return Object.keys(o)
    .sort()
    .map((k) => str(obj(o[k])?.name) ?? "")
    .filter(Boolean)
}

function readVariant(v: unknown, index: number, fallback: Json): Variant {
  const o = obj(v) ?? {}
  // Legacy single-loadout documents have no `variants`; their loadout lives on
  // the top-level fields, which is what `fallback` carries.
  const src = Object.keys(o).length > 0 ? o : fallback
  return {
    key: str(o.id) ?? `#${index}`,
    label: str(o.label) ?? "",
    mods: Object.values(obj(src.slots) ?? {})
      .map(placedMod)
      .filter((m): m is Placed => m !== null),
    arcanes: arr(src.arcanes)
      .map(placedArcane)
      .filter((a): a is Placed => a !== null),
    shards: arr(src.shards).map(stamp),
    helminth: helminthNames(src.helminth ?? fallback.helminth),
    // JSON rather than concatenation: guide prose and perk names can contain
    // any separator character, and two different pairs must never stringify to
    // the same value or a real edit would read as a no-op.
    guide: JSON.stringify([
      str(src.guideSummary) ?? "",
      str(src.guideDescription) ?? "",
    ]),
    incarnon: JSON.stringify([
      src.incarnonEnabled === true,
      arr(src.incarnonPerks).map((p) => str(p) ?? ""),
    ]),
  }
}

function readVariants(doc: Json): Variant[] {
  const list = arr(doc.variants)
  if (list.length === 0) return [readVariant(null, 0, doc)]
  return list.map((v, i) => readVariant(v, i, doc))
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/** Adds and removes of the same name inside one variant are a slot move, not
 *  an edit — drop both sides. Rank changes are matched here too, so swapping a
 *  mod's rank while also moving it still reads as a single `~` line. */
function cancelMoves(added: Placed[], removed: Placed[]): BuildChange[] {
  const out: BuildChange[] = []
  const removedBy = new Map<string, Placed>()
  for (const r of removed) removedBy.set(r.name, r)

  const survivingAdds: Placed[] = []
  for (const a of added) {
    const match = removedBy.get(a.name)
    if (!match) {
      survivingAdds.push(a)
      continue
    }
    removedBy.delete(a.name)
    if (match.rank !== a.rank) {
      out.push({
        op: "modify",
        label: a.name,
        detail: `rank ${match.rank ?? 0} → ${a.rank ?? 0}`,
      })
    }
  }

  for (const r of removedBy.values()) {
    out.push({
      op: "remove",
      label: r.name,
      ...(r.rank !== null && { detail: `rank ${r.rank}` }),
    })
  }
  for (const a of survivingAdds) {
    out.push({
      op: "add",
      label: a.name,
      ...(a.rank !== null && { detail: `rank ${a.rank}` }),
    })
  }
  return out
}

function countChanged(before: string[], after: string[]): number {
  const len = Math.max(before.length, after.length)
  let n = 0
  for (let i = 0; i < len; i++) if (before[i] !== after[i]) n++
  return n
}

function diffVariant(before: Variant, after: Variant): BuildChange[] {
  const out: BuildChange[] = [
    ...cancelMoves(after.mods, before.mods),
    ...cancelMoves(after.arcanes, before.arcanes),
  ]

  const shardsChanged = countChanged(before.shards, after.shards)
  if (shardsChanged > 0) {
    const total = Math.max(after.shards.length, before.shards.length)
    out.push({
      op: "modify",
      label: "Archon Shards",
      detail: `${shardsChanged} of ${total} changed`,
    })
  }

  // Helminth isn't a slot, so there's no +/- form for it — name the swap.
  const bh = before.helminth.join(", ")
  const ah = after.helminth.join(", ")
  if (bh !== ah) {
    out.push({
      op: "modify",
      label: "Helminth",
      detail: bh && ah ? `${bh} → ${ah}` : ah ? `added ${ah}` : `removed ${bh}`,
    })
  }

  if (before.incarnon !== after.incarnon) {
    out.push({ op: "modify", label: "Incarnon", detail: "perks changed" })
  }

  // A guide edit is a real change that no +/- line can describe.
  if (before.guide !== after.guide) {
    out.push({ op: "info", label: "Guide updated" })
  }

  return out.map((c) => (after.label ? { ...c, scope: after.label } : c))
}

function diffBuildWide(before: Json, after: Json): BuildChange[] {
  const out: BuildChange[] = []

  if (before.hasReactor !== after.hasReactor) {
    out.push({
      op: "modify",
      label: after.hasReactor === false ? "Reactor removed" : "Reactor added",
      detail: "capacity changed",
    })
  }
  if (stamp(before.zawComponents) !== stamp(after.zawComponents)) {
    out.push({ op: "modify", label: "Zaw parts", detail: "changed" })
  }
  if (stamp(before.kitgunComponents) !== stamp(after.kitgunComponents)) {
    out.push({ op: "modify", label: "Kitgun parts", detail: "changed" })
  }
  if (str(before.lichBonusElement) !== str(after.lichBonusElement)) {
    out.push({
      op: "modify",
      label: "Lich element",
      detail: str(after.lichBonusElement) ?? "cleared",
    })
  }

  return out
}

/**
 * Change list describing how `after` differs from `before`. Always returns at
 * least one entry — a save that changed nothing still gets a row, because
 * "Cynical saved this and nothing moved" is itself the answer to "what did
 * Cynical do".
 */
export function diffBuildData(before: unknown, after: unknown): BuildChange[] {
  const a = obj(before)
  const b = obj(after)
  if (!a || !b) return [{ op: "info", label: "Updated" }]

  const beforeVariants = readVariants(a)
  const afterVariants = readVariants(b)
  const byKey = new Map(beforeVariants.map((v) => [v.key, v]))

  const out: BuildChange[] = []

  afterVariants.forEach((av, i) => {
    // Match on the variant's stable id, falling back to position for documents
    // written before variants carried ids.
    const prev = byKey.get(av.key) ?? beforeVariants[i]
    if (prev && byKey.has(av.key)) byKey.delete(av.key)
    else if (prev && prev.key.startsWith("#")) byKey.delete(prev.key)

    if (!prev) {
      // A fresh variant reads as "every slot added" — ~10 green lines that say
      // less than one. Collapse it; the prototype showed the long form drowns
      // everything around it.
      out.push({
        op: "add",
        ...(av.label && { scope: av.label }),
        label: "Variant added",
        detail: `${av.mods.length} mods`,
      })
      return
    }

    if (prev.label !== av.label && prev.label && av.label) {
      out.push({
        op: "modify",
        scope: av.label,
        label: "Variant renamed",
        detail: `${prev.label} → ${av.label}`,
      })
    }
    out.push(...diffVariant(prev, av))
  })

  for (const gone of byKey.values()) {
    out.push({
      op: "remove",
      ...(gone.label && { scope: gone.label }),
      label: "Variant removed",
    })
  }

  out.push(...diffBuildWide(a, b))

  if (out.length === 0) return [{ op: "info", label: "No loadout changes" }]
  if (out.length > MAX_CHANGES) {
    const kept = out.slice(0, MAX_CHANGES)
    kept.push({
      op: "info",
      label: `…and ${out.length - MAX_CHANGES} more changes`,
    })
    return kept
  }
  return out
}

/**
 * Fold consecutive same-editor entries into one change list. A single editing
 * session produces a burst of saves — without this the log fills with
 * "No loadout changes" rows within a week and stops being readable.
 *
 * Ordering matters: `lists` must be oldest-first, so a later op on the same
 * label wins. Adds and removes across the burst cancel exactly as they do
 * within one save (mod in, mod back out = nothing happened).
 */
export function mergeChanges(lists: BuildChange[][]): BuildChange[] {
  const merged = new Map<string, BuildChange>()
  for (const list of lists) {
    for (const c of list) {
      // Informational lines aren't stateful — one "Guide updated" for the
      // whole burst, no matter how many saves touched it.
      if (c.op === "info") {
        if (c.label === "No loadout changes") continue
        merged.set(`info|${c.scope ?? ""}|${c.label}`, c)
        continue
      }
      const key = `${c.scope ?? ""}|${c.label}`
      const prior = merged.get(key)
      if (prior && prior.op === "add" && c.op === "remove") {
        merged.delete(key)
        continue
      }
      if (prior && prior.op === "remove" && c.op === "add") {
        merged.delete(key)
        continue
      }
      merged.set(key, c)
    }
  }
  const out = [...merged.values()]
  return out.length > 0 ? out : [{ op: "info", label: "No loadout changes" }]
}
