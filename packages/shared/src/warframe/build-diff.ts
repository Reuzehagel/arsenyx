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

import {
  asRecord,
  type PlacedArcane,
  type PlacedMod,
  type SavedBuildData,
  type SavedVariant,
  type Untrusted,
  type VariantMode,
} from "./build-data"

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
const MAX_CHANGES = 40

/** The `info` label a save that moved nothing gets. Readers filter on it. */
export const NO_CHANGES_LABEL = "No loadout changes"

/** Per-field length cap on stored changes. Labels, scopes and details echo
 *  user strings (variant labels, mod names) and a variant's label is stamped
 *  onto every one of its changes — uncapped, one PATCH could store ~40× its
 *  own body. Generous for any real name. */
const MAX_FIELD = 120

function clip(s: string): string {
  return s.length > MAX_FIELD ? `${s.slice(0, MAX_FIELD - 1)}…` : s
}

function clipChange(c: BuildChange): BuildChange {
  return {
    ...c,
    label: clip(c.label),
    ...(c.scope !== undefined && { scope: clip(c.scope) }),
    ...(c.detail !== undefined && { detail: clip(c.detail) }),
  }
}

// ---------------------------------------------------------------------------
// Defensive readers over the persisted shape (SavedBuildData). Field names are
// checked against the real types; every value is still treated as unknown.
// ---------------------------------------------------------------------------

type DocJson = Untrusted<SavedBuildData>

const obj = asRecord<Record<string, unknown>>

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
  const o: Untrusted<PlacedMod> | null = obj(v)
  if (!o) return null
  const name = str(obj(o.mod)?.name)
  return name ? { name, rank: num(o.rank) } : null
}

function placedArcane(v: unknown): Placed | null {
  const o: Untrusted<PlacedArcane> | null = obj(v)
  if (!o) return null
  const name = str(obj(o.arcane)?.name)
  return name ? { name, rank: num(o.rank) } : null
}

interface Variant {
  key: string
  label: string
  /** Twin-frame form index; 0 for normal frames. */
  form: number
  mods: Placed[]
  arcanes: Placed[]
  shards: string[]
  forma: Record<string, unknown>
  helminth: string[]
  guideSummary: string | null
  guideDescription: string | null
  incarnonEnabled: boolean
  incarnonPerks: string[]
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

function readVariant(v: unknown, index: number, fallback: DocJson): Variant {
  const o: Untrusted<SavedVariant> = obj(v) ?? {}
  // Legacy single-loadout documents have no `variants`; their loadout lives on
  // the top-level fields, which is what `fallback` carries.
  const src: Untrusted<SavedVariant> = Object.keys(o).length > 0 ? o : fallback
  return {
    key: str(o.id) ?? `#${index}`,
    label: str(o.label) ?? "",
    form: num(o.formIndex) ?? 0,
    mods: Object.values(obj(src.slots) ?? {})
      .map(placedMod)
      .filter((m): m is Placed => m !== null),
    arcanes: arr(src.arcanes)
      .map(placedArcane)
      .filter((a): a is Placed => a !== null),
    shards: arr(src.shards).map(stamp),
    // Variants saved before per-variant forma only have the top-level set.
    forma: obj(src.formaPolarities) ?? obj(fallback.formaPolarities) ?? {},
    helminth: helminthNames(src.helminth ?? fallback.helminth),
    // Kept as separate fields and compared field-by-field. Folding them into
    // one string would mean allocating a copy of the guide prose (up to 50 KB
    // a variant) on both sides of every diff, and would need escaping so two
    // different pairs couldn't collide into the same value.
    guideSummary: str(src.guideSummary),
    guideDescription: str(src.guideDescription),
    incarnonEnabled: src.incarnonEnabled === true,
    incarnonPerks: arr(src.incarnonPerks).map((p) => str(p) ?? ""),
  }
}

/** The stored mode, or for builds saved before it existed, "independent" when
 *  two variants of the same form disagree on forma or shards — the same
 *  inference the editor's `resolveVariantMode` makes on load. */
function variantModeOf(doc: DocJson, variants: Variant[]): VariantMode {
  if (doc.variantMode === "linked" || doc.variantMode === "independent")
    return doc.variantMode
  const seen = new Map<number, string>()
  for (const v of variants) {
    const sig = `${stamp(v.forma)}|${v.shards.join(";")}`
    const prior = seen.get(v.form)
    if (prior !== undefined && prior !== sig) return "independent"
    seen.set(v.form, sig)
  }
  return "linked"
}

function readVariants(doc: DocJson): Variant[] {
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
  // A multiset, not one entry per name: nothing stops a persisted document
  // from carrying the same name twice, and collapsing the duplicates would
  // leave one side of the pair unmatched — an unchanged save would log a
  // stray `+`.
  const removedBy = new Map<string, Placed[]>()
  for (const r of removed) {
    const bucket = removedBy.get(r.name)
    if (bucket) bucket.push(r)
    else removedBy.set(r.name, [r])
  }

  const survivingAdds: Placed[] = []
  for (const a of added) {
    const bucket = removedBy.get(a.name)
    if (!bucket || bucket.length === 0) {
      survivingAdds.push(a)
      continue
    }
    // Prefer the copy at the same rank, so two placements at different ranks
    // don't read as two rank changes when neither actually moved.
    const exact = bucket.findIndex((r) => r.rank === a.rank)
    const match = bucket.splice(exact >= 0 ? exact : 0, 1)[0]
    if (bucket.length === 0) removedBy.delete(a.name)
    if (match.rank !== a.rank) {
      out.push({
        op: "modify",
        label: a.name,
        detail: `rank ${match.rank ?? 0} → ${a.rank ?? 0}`,
      })
    }
  }

  for (const bucket of removedBy.values()) {
    for (const r of bucket) {
      out.push({
        op: "remove",
        label: r.name,
        ...(r.rank !== null && { detail: `rank ${r.rank}` }),
      })
    }
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

function formaChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): BuildChange[] {
  const slots = new Set([...Object.keys(before), ...Object.keys(after)])
  const n = [...slots].filter((k) => str(before[k]) !== str(after[k])).length
  if (n === 0) return []
  return [
    {
      op: "modify",
      label: "Forma",
      detail: `${n} ${n === 1 ? "slot" : "slots"} changed`,
    },
  ]
}

function diffVariant(
  before: Variant,
  after: Variant,
  perVariantForma: boolean,
): BuildChange[] {
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

  // Linked builds share one forma set — diffBuildWide reports it once.
  if (perVariantForma) out.push(...formaChange(before.forma, after.forma))

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

  if (
    before.incarnonEnabled !== after.incarnonEnabled ||
    countChanged(before.incarnonPerks, after.incarnonPerks) > 0
  ) {
    out.push({ op: "modify", label: "Incarnon", detail: "perks changed" })
  }

  // A guide edit is a real change that no +/- line can describe.
  if (
    before.guideSummary !== after.guideSummary ||
    before.guideDescription !== after.guideDescription
  ) {
    out.push({ op: "info", label: "Guide updated" })
  }

  return out.map((c) => (after.label ? { ...c, scope: after.label } : c))
}

function diffBuildWide(before: DocJson, after: DocJson): BuildChange[] {
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
  const modeBefore = variantModeOf(a, beforeVariants)
  const modeAfter = variantModeOf(b, afterVariants)
  // Forma goes per variant when either side is independent: switching to
  // shared overwrites the other variants' forma, which a build-wide compare of
  // the active set can't see. Twin-frame forms each have their own forma even
  // when linked, so a build spanning forms reports forma per variant too.
  const independent =
    modeBefore === "independent" ||
    modeAfter === "independent" ||
    new Set(afterVariants.map((v) => v.form)).size > 1

  const out: BuildChange[] = []
  if (modeBefore !== modeAfter) {
    out.push({
      op: "modify",
      label: "Forma & shards",
      detail: modeAfter === "linked" ? "now shared" : "now per variant",
    })
  }

  afterVariants.forEach((av, i) => {
    // Match on the variant's stable id. Position is only a fallback for
    // documents written before variants carried ids — with ids on both sides a
    // miss means the variant is genuinely new, and pairing it with whatever sat
    // at its index would turn "variant added" into a mod-by-mod diff against an
    // unrelated loadout (the editor's Duplicate inserts mid-array, so this is
    // the common case, not a corner one).
    const positional = beforeVariants[i]
    const positionalMatch =
      positional &&
      byKey.has(positional.key) &&
      (av.key.startsWith("#") || positional.key.startsWith("#"))
        ? positional
        : undefined
    const prev = byKey.get(av.key) ?? positionalMatch
    if (prev) byKey.delete(prev.key)

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
    out.push(...diffVariant(prev, av, independent))
  })

  for (const gone of byKey.values()) {
    out.push({
      op: "remove",
      ...(gone.label && { scope: gone.label }),
      label: "Variant removed",
    })
  }

  out.push(...diffBuildWide(a, b))
  if (!independent)
    out.push(
      ...formaChange(
        obj(a.formaPolarities) ?? {},
        obj(b.formaPolarities) ?? {},
      ),
    )

  if (out.length === 0) return [{ op: "info", label: NO_CHANGES_LABEL }]
  if (out.length > MAX_CHANGES) {
    const kept = out.slice(0, MAX_CHANGES).map(clipChange)
    kept.push({
      op: "info",
      label: `…and ${out.length - MAX_CHANGES} more changes`,
    })
    return kept
  }
  return out.map(clipChange)
}

/** The op that undoes each op. */
const CANCELS: Partial<Record<BuildChangeOp, BuildChangeOp>> = {
  add: "remove",
  remove: "add",
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
        if (c.label === NO_CHANGES_LABEL) continue
        merged.set(`info|${c.scope ?? ""}|${c.label}`, c)
        continue
      }
      const key = `${c.scope ?? ""}|${c.label}`
      const prior = merged.get(key)
      // In then out (or out then in) across the burst = nothing happened.
      if (prior && CANCELS[prior.op] === c.op) {
        merged.delete(key)
        continue
      }
      merged.set(key, c)
    }
  }
  const out = [...merged.values()]
  return out.length > 0 ? out : [{ op: "info", label: NO_CHANGES_LABEL }]
}
