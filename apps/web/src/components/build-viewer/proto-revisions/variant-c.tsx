/* PROTOTYPE — issue #331. Variant C: on-demand side panel with room to grow. */
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
import { formatAbsoluteTime, relativeTime } from "@/lib/util/relative-time"

import { ChangeList } from "./change-list"
import {
  groupByDay,
  initials,
  PROTO_REVISIONS,
  type ProtoRevision,
} from "./stub-data"

/**
 * Variant C — a "History" button in the header's action row opens a right-hand
 * sheet, grouped by day. Zero footprint until asked for, and the only variant
 * with room for a long history, per-entry avatars, or a future diff/restore
 * affordance. Costs a deliberate click, so nobody discovers an edit passively.
 */
/** The one-line description under the editor's name. With diffs on, a save
 *  that has a change list describes itself — the "Edited the build" filler is
 *  only there to stop the row looking empty, so it goes. */
function caption(r: ProtoRevision, showDiff: boolean): string | null {
  if (r.note) return r.note
  if (r.kind === "created") return "Created the build"
  if (showDiff && r.changes) return null
  return "Edited the build"
}

export function VariantCTrigger({ showDiff = false }: { showDiff?: boolean }) {
  const [open, setOpen] = useState(false)
  const groups = groupByDay(PROTO_REVISIONS)
  // Controlled, matching header.tsx's mobile-nav sheet.
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
            {PROTO_REVISIONS.length} edits · only visible to people who can edit
            this build
          </p>
        </SheetHeader>

        {/* min-h-0: without it the flex child refuses to shrink below its
            content and the whole sheet grows past the viewport once the diffs
            are in — the list stops scrolling and the oldest entries are
            unreachable. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {groups.map((g) => (
            <section key={g.label} className="mb-4 last:mb-0">
              <h3 className="text-muted-foreground bg-popover sticky top-0 py-1.5 text-[11px] font-medium tracking-wide uppercase">
                {g.label}
              </h3>
              <ol className="flex flex-col">
                {g.items.map((r) => (
                  <li
                    key={r.id}
                    className="border-border/50 flex gap-3 border-t py-3 first:border-t-0"
                  >
                    <span className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
                      {initials(r.editor.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {r.editor.name}
                        </span>
                        <span
                          className="text-muted-foreground shrink-0 text-xs"
                          title={formatAbsoluteTime(r.at)}
                        >
                          {relativeTime(r.at)}
                        </span>
                      </div>
                      {caption(r, showDiff) ? (
                        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                          {caption(r, showDiff)}
                        </p>
                      ) : null}
                      {showDiff && r.changes ? (
                        <ChangeList groups={r.changes} />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
