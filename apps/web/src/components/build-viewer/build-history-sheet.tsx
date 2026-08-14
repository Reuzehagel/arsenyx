import type { BuildChangeResponse } from "@arsenyx/shared/api/build-dto"
import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildRevisionsQuery,
  type BuildRevision,
} from "@/lib/queries/build-revisions-query"
import { formatAbsoluteTime, relativeTime } from "@/lib/util/relative-time"
import { authorName } from "@/lib/util/user-display"
import { cn } from "@/lib/util/utils"

/** Change lines shown before collapsing. A rebuilt loadout can carry dozens;
 *  past a handful the entry stops being skimmable and buries its neighbours. */
const MAX_LINES = 4

const SIGIL: Record<BuildChangeResponse["op"], string> = {
  add: "+",
  remove: "−",
  modify: "~",
  info: " ",
}

const TONE: Record<BuildChangeResponse["op"], string> = {
  add: "text-positive",
  remove: "text-destructive",
  modify: "text-muted-foreground",
  info: "text-muted-foreground italic",
}

function ChangeLines({ changes }: { changes: BuildChangeResponse[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? changes : changes.slice(0, MAX_LINES)
  const hidden = changes.length - shown.length

  // Scope (the variant label) repeats across consecutive lines from the same
  // variant — print it once as a heading rather than on every row.
  let lastScope: string | undefined
  return (
    <div className="mt-1.5 flex flex-col gap-px">
      {shown.map((c, i) => {
        const heading = c.scope && c.scope !== lastScope ? c.scope : null
        lastScope = c.scope
        return (
          <div key={`${c.op}-${c.label}-${i}`}>
            {heading ? (
              <p className="text-muted-foreground/60 mt-1.5 mb-0.5 text-[10px] tracking-wide uppercase first:mt-0">
                {heading}
              </p>
            ) : null}
            <p className={cn("flex gap-1.5 font-mono text-[11px]", TONE[c.op])}>
              <span aria-hidden className="w-2 shrink-0 select-none">
                {SIGIL[c.op]}
              </span>
              <span className="min-w-0">
                {c.label}
                {c.detail ? (
                  <span className="text-muted-foreground/70">
                    {" "}
                    · {c.detail}
                  </span>
                ) : null}
              </span>
            </p>
          </div>
        )
      })}
      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground mt-1 cursor-pointer self-start font-mono text-[10px] underline underline-offset-2"
        >
          {expanded ? "show less" : `+${hidden} more`}
        </button>
      ) : null}
    </div>
  )
}

function dayLabel(iso: string): string {
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
    ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  })
}

function groupByDay(revisions: BuildRevision[]) {
  const out: { label: string; items: BuildRevision[] }[] = []
  for (const r of revisions) {
    const label = dayLabel(r.at)
    const last = out.at(-1)
    if (last && last.label === label) last.items.push(r)
    else out.push({ label, items: [r] })
  }
  return out
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function Entry({ revision }: { revision: BuildRevision }) {
  // A deleted account leaves its entries behind (BuildRevision.editorId is
  // SetNull) — the history of who touched what shouldn't vanish with the user.
  const who = revision.editor
    ? authorName(revision.editor)
    : "A removed account"
  return (
    <li className="border-border/50 flex gap-3 border-t py-3 first:border-t-0">
      <span className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
        {initials(who)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{who}</span>
          <span
            className="text-muted-foreground shrink-0 text-xs"
            title={formatAbsoluteTime(revision.at)}
          >
            {relativeTime(revision.at)}
          </span>
        </div>
        {revision.saves > 1 ? (
          <p className="text-muted-foreground/60 text-[10px]">
            {revision.saves} saves
          </p>
        ) : null}
        {revision.notes.map((note) => (
          <p
            key={note}
            className="text-muted-foreground mt-0.5 text-xs leading-snug"
          >
            {note}
          </p>
        ))}
        {revision.kind === "CREATED" ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            Created the build
          </p>
        ) : (
          <ChangeLines changes={revision.changes} />
        )}
      </div>
    </li>
  )
}

/**
 * A build's edit log, behind a "History" button in the viewer header. Rendered
 * only for viewers who can edit the build (`BuildDetail.isOwner`, which is
 * really "can mutate" — see the api's canMutateBuild), matching the server-side
 * gate on the revisions route.
 *
 * The list is fetched on first open rather than with the page: most visitors
 * can't see it at all, and those who can rarely want it.
 */
export function BuildHistorySheet({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const { data, isPending, isError } = useQuery(buildRevisionsQuery(slug, open))
  const groups = groupByDay(data?.revisions ?? [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <History data-icon="inline-start" />
        History
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit history</SheetTitle>
          <p className="text-muted-foreground text-xs">
            Only visible to people who can edit this build
          </p>
        </SheetHeader>

        {/* min-h-0 lets this flex child shrink below its content so the list
            scrolls inside the sheet instead of pushing it past the viewport. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {isPending ? (
            <div className="flex flex-col gap-3 pt-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="text-muted-foreground pt-2 text-sm">
              Couldn't load the history.
            </p>
          ) : groups.length === 0 ? (
            // Builds saved before this log existed have no entries at all —
            // say so rather than showing an empty panel.
            <p className="text-muted-foreground pt-2 text-sm">
              No edits recorded yet. History starts from the next save.
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mb-4 last:mb-0">
                <h3 className="text-muted-foreground bg-popover sticky top-0 py-1.5 text-[11px] font-medium tracking-wide uppercase">
                  {g.label}
                </h3>
                <ol className="flex flex-col">
                  {g.items.map((r) => (
                    <Entry key={r.id} revision={r} />
                  ))}
                </ol>
              </section>
            ))
          )}
          {data?.truncated ? (
            <p className="text-muted-foreground/60 pt-2 text-[11px]">
              Older edits aren't shown.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
