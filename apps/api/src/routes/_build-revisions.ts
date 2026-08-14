import type { BuildRevisionResponse } from "@arsenyx/shared/api/build-dto"
import {
  diffBuildData,
  mergeChanges,
  type BuildChange,
} from "@arsenyx/shared/warframe/build-diff"

import { prisma, registerBackgroundWork } from "../db"
import type {
  BuildRevisionKind,
  BuildVisibility,
} from "../generated/prisma/enums"
import { BUILD_USER_SELECT } from "./_build-list"

// The edit log behind `GET /builds/:slug/revisions`. The route itself (auth,
// permission gate, response) stays in builds.ts; everything here is the shape
// of an entry — how a save is described on write, and how a burst of saves
// collapses on read.

/** Matches BuildRevision.note's @db.VarChar(300). */
export const MAX_REVISION_NOTE = 300

/**
 * What a PATCH changed, as a stored change list. The loadout diff comes from
 * the shared differ; the fields that live in columns rather than in buildData
 * (name, visibility, organization, the guide row) have no representation
 * there, so they are appended here — otherwise a rename would log as "No
 * loadout changes", which is worse than saying nothing.
 */
export function describeEdit(
  existing: {
    buildData: unknown
    name: string
    visibility: BuildVisibility
    organizationId: string | null
    buildGuide: { summary: string | null; description: string | null } | null
  },
  data: Record<string, unknown>,
  guide: { summary: string | null; description: string | null } | null,
): BuildChange[] {
  const out: BuildChange[] =
    data.buildData !== undefined
      ? diffBuildData(existing.buildData, data.buildData)
      : []

  if (typeof data.name === "string" && data.name !== existing.name) {
    out.push({
      op: "modify",
      label: "Renamed",
      detail: `${existing.name} → ${data.name}`,
    })
  }
  if (data.visibility != null && data.visibility !== existing.visibility) {
    out.push({
      op: "modify",
      label: "Visibility",
      detail: `${existing.visibility} → ${String(data.visibility)}`,
    })
  }
  // Compare content, not presence: the editor sends `guide` on every save
  // whether or not it changed, which is why the PATCH selects the existing
  // guide row at all.
  if (
    guide &&
    (guide.summary !== (existing.buildGuide?.summary ?? null) ||
      guide.description !== (existing.buildGuide?.description ?? null))
  ) {
    out.push({ op: "info", label: "Guide updated" })
  }
  // Values, not presence — same trap. The editor puts `organizationId` in
  // every save body (it defaults to the build's current org), so a presence
  // check stamps "Organization changed" on every edit.
  if (
    data.organizationId !== undefined &&
    data.organizationId !== existing.organizationId
  ) {
    out.push({ op: "info", label: "Organization changed" })
  }

  // Drop the placeholder once something real landed alongside it — a rename
  // that touched no slots shouldn't read "No loadout changes · Renamed".
  const real = out.filter((ch) => ch.label !== "No loadout changes")
  if (real.length > 0) return real
  return out.length > 0 ? out : [{ op: "info", label: "Updated" }]
}

/**
 * Trim a build's log to the newest {@link MAX_STORED_REVISIONS}. Sampled
 * rather than run on every save, matching the view-day prune in builds.ts:
 * saves are already rate-limited, so an occasional trim is enough to keep the
 * table bounded, and it costs nothing on the other 98% of writes.
 */
const MAX_STORED_REVISIONS = 200
export function pruneRevisions(buildId: string) {
  if (Math.random() >= 0.02) return
  registerBackgroundWork(
    prisma.$executeRaw`
      DELETE FROM build_revisions
      WHERE "buildId" = ${buildId}
        AND id NOT IN (
          SELECT id FROM build_revisions
          WHERE "buildId" = ${buildId}
          ORDER BY "createdAt" DESC
          LIMIT ${MAX_STORED_REVISIONS}
        )
    `.catch((err) => console.error("revision prune failed", err)),
  )
}

// Consecutive saves by one editor inside this window collapse into a single
// entry. A normal editing session fires several saves a minute apart; without
// folding the log fills with near-empty rows within a week and stops being
// worth opening.
const REVISION_FOLD_MS = 30 * 60 * 1000
// Raw rows read before folding. Folding shrinks the list, so the response
// usually holds far fewer entries than this.
const REVISION_READ_LIMIT = 120

export type RevisionRow = {
  id: string
  createdAt: Date
  kind: BuildRevisionKind
  note: string | null
  changes: unknown
  editor: BuildRevisionResponse["editor"]
}

/** The newest slice of a build's log, already folded, plus whether older
 *  entries exist beyond it. */
export async function readRevisions(buildId: string) {
  const rows = await prisma.buildRevision.findMany({
    where: { buildId },
    orderBy: { createdAt: "desc" },
    take: REVISION_READ_LIMIT + 1,
    relationLoadStrategy: "join",
    select: {
      id: true,
      createdAt: true,
      kind: true,
      note: true,
      changes: true,
      editor: { select: BUILD_USER_SELECT },
    },
  })
  return {
    revisions: foldRevisions(rows.slice(0, REVISION_READ_LIMIT)),
    truncated: rows.length > REVISION_READ_LIMIT,
  }
}

function toChanges(raw: unknown): BuildChange[] {
  return Array.isArray(raw) ? (raw as BuildChange[]) : []
}

/**
 * Fold a newest-first row list into display entries, collapsing runs of
 * same-editor saves inside {@link REVISION_FOLD_MS}. A CREATED row never folds
 * into anything — "who made this" is a different fact from "who edited it".
 */
export function foldRevisions(rows: RevisionRow[]): BuildRevisionResponse[] {
  const out: BuildRevisionResponse[] = []
  let group: RevisionRow[] = []

  const flush = () => {
    if (group.length === 0) return
    const newest = group[0]
    out.push({
      id: newest.id,
      at: newest.createdAt.toISOString(),
      kind: newest.kind,
      editor: newest.editor,
      notes: [...new Set(group.map((r) => r.note).filter((n) => n !== null))],
      // mergeChanges wants oldest-first so later edits win; the group is
      // newest-first because the query is.
      changes: mergeChanges(
        [...group].reverse().map((r) => toChanges(r.changes)),
      ),
      saves: group.length,
    })
    group = []
  }

  for (const row of rows) {
    const head = group[0]
    const foldable =
      head != null &&
      row.kind === "EDITED" &&
      head.kind === "EDITED" &&
      (head.editor?.id ?? null) === (row.editor?.id ?? null) &&
      head.createdAt.getTime() - row.createdAt.getTime() < REVISION_FOLD_MS
    if (!foldable) flush()
    group.push(row)
  }
  flush()

  return out
}
