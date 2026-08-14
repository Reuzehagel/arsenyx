/* PROTOTYPE — issue #331 (build edit history). Throwaway, delete with the
 * prototype. No API and no BuildRevision table exists yet, so every variant
 * renders this fixed stub. */

/** One line of a rendered diff. `info` is the escape hatch for every edit that
 *  isn't a clean slot swap — guide text, shards, "nothing actually changed" —
 *  which is most of them. */
export type ProtoChange =
  | { op: "add"; label: string; detail?: string }
  | { op: "remove"; label: string; detail?: string }
  | { op: "modify"; label: string; detail: string }
  | { op: "info"; label: string }

/** Changes are scoped to a variant — a build here carries up to 5, so an
 *  unscoped "+ Pressure Point" doesn't say enough to be useful. */
export interface ProtoChangeGroup {
  scope?: string
  items: ProtoChange[]
}

export interface ProtoRevision {
  id: string
  /** Who saved. Today's Build row has no equivalent field — see builds.ts
   *  canMutateBuild(), where any org member can edit with no attribution. */
  editor: { name: string; username: string }
  at: string
  kind: "created" | "edited"
  /** Author-typed note. Deliberately optional — most saves won't have one, and
   *  the variants have to look right when the column is mostly empty. */
  note?: string
  /** Server-computed diff vs the previous revision. Absent on the first one. */
  changes?: ProtoChangeGroup[]
}

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString()

/** Newest first. Entries 2-4 are a deliberate rapid-save burst from a single
 * editing session — the case that decides whether the list needs collapsing. */
export const PROTO_REVISIONS: ProtoRevision[] = [
  {
    id: "r8",
    editor: { name: "Cynical", username: "qcynical" },
    at: minutesAgo(41),
    kind: "edited",
    note: "Swapped Blind Rage for Transient Fortitude — duration was too short for the Steel Path variant",
    // The clean case the diff is actually good at.
    changes: [
      {
        scope: "Influence General Xata's",
        items: [
          { op: "remove", label: "Blind Rage", detail: "rank 6" },
          { op: "add", label: "Transient Fortitude", detail: "rank 5" },
          { op: "modify", label: "Overextended", detail: "rank 5 → 4" },
        ],
      },
    ],
  },
  {
    id: "r7",
    editor: { name: "Cynical", username: "qcynical" },
    at: minutesAgo(52),
    kind: "edited",
    // A save with no net change — the burst is mostly these.
    changes: [{ items: [{ op: "info", label: "No loadout changes" }] }],
  },
  {
    id: "r6",
    editor: { name: "Cynical", username: "qcynical" },
    at: minutesAgo(55),
    kind: "edited",
    changes: [
      {
        scope: "Influence Evade Okina",
        items: [
          { op: "remove", label: "Arcane Energize", detail: "rank 5" },
          { op: "add", label: "Arcane Aegis", detail: "rank 5" },
        ],
      },
    ],
  },
  {
    id: "r5",
    editor: { name: "Cynical", username: "qcynical" },
    at: minutesAgo(58),
    kind: "edited",
    // Not a loadout change at all — no +/- line can describe it.
    changes: [{ items: [{ op: "info", label: "Guide updated" }] }],
  },
  {
    id: "r4",
    editor: { name: "Reuzehagel", username: "reuzehagel" },
    at: minutesAgo(60 * 27),
    kind: "edited",
    note: "Added the Steel Path variant",
    // A whole new variant: every slot reads as an addition, so the diff is
    // long and says nothing the note doesn't. Tests the line cap.
    changes: [
      {
        scope: "Exterminate Nuke",
        items: [
          { op: "info", label: "Variant added" },
          { op: "add", label: "Corrosive Projection" },
          { op: "add", label: "Primed Sure Footed" },
          { op: "add", label: "Molecular Fission" },
          { op: "add", label: "Neutron Star" },
          { op: "add", label: "Primed Continuity" },
          { op: "add", label: "Equilibrium" },
          { op: "add", label: "Augur Reach" },
          { op: "add", label: "Archon Stretch" },
        ],
      },
    ],
  },
  {
    id: "r3",
    editor: { name: "Nova", username: "novaprime" },
    at: minutesAgo(60 * 24 * 6),
    kind: "edited",
    note: "Re-ranked the arcane after the cap change",
    changes: [
      {
        scope: "General MPrime Platform",
        items: [
          { op: "modify", label: "Molt Augmented", detail: "rank 4 → 5" },
        ],
      },
    ],
  },
  {
    id: "r2",
    editor: { name: "Reuzehagel", username: "reuzehagel" },
    at: minutesAgo(60 * 24 * 21),
    kind: "edited",
    // Shards aren't slots either — another shape the +/- form doesn't fit.
    changes: [
      {
        scope: "Spinnerex Wheelchair",
        items: [
          { op: "modify", label: "Archon Shards", detail: "2 of 5 changed" },
          { op: "modify", label: "Helminth", detail: "Roar → Xata's Whisper" },
        ],
      },
    ],
  },
  {
    id: "r1",
    editor: { name: "Reuzehagel", username: "reuzehagel" },
    at: minutesAgo(60 * 24 * 96),
    kind: "created",
    note: "Created the build",
  },
]

/** Day bucket label for the grouped variants. */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })
}

export function groupByDay(revs: ProtoRevision[]) {
  const out: { label: string; items: ProtoRevision[] }[] = []
  for (const r of revs) {
    const label = dayLabel(r.at)
    const last = out.at(-1)
    if (last && last.label === label) last.items.push(r)
    else out.push({ label, items: [r] })
  }
  return out
}

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
