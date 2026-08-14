/* PROTOTYPE — issue #331. Variant A: always-on inline card. */
import { History } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatAbsoluteTime, relativeTime } from "@/lib/util/relative-time"

import { PROTO_REVISIONS } from "./stub-data"

const PREVIEW = 3

/**
 * Variant A — "Edit history" as a persistent card between the header and the
 * loadout, mirroring ViewerHeader's card chrome. Highest prominence: an editor
 * sees the last few saves without doing anything. Costs vertical space above
 * the fold on every visit, for everyone who can edit.
 */
export function VariantA() {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? PROTO_REVISIONS : PROTO_REVISIONS.slice(0, PREVIEW)
  const hidden = PROTO_REVISIONS.length - shown.length

  return (
    <div className="bg-card mb-4 rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="text-muted-foreground size-4" />
        <h2 className="text-sm font-medium">Edit history</h2>
        <span className="text-muted-foreground text-xs">
          {PROTO_REVISIONS.length} edits
        </span>
        <span className="text-muted-foreground ml-auto text-xs">
          Only visible to people who can edit this build
        </span>
      </div>

      <ol className="border-border/60 flex flex-col gap-2.5 border-l pl-4">
        {shown.map((r) => (
          <li key={r.id} className="relative text-sm">
            <span className="bg-border absolute top-[0.45rem] -left-[1.3rem] size-1.5 rounded-full" />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{r.editor.name}</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="text-muted-foreground cursor-default text-xs">
                      {r.kind === "created" ? "created" : "edited"}{" "}
                      {relativeTime(r.at)}
                    </span>
                  }
                />
                <TooltipContent>{formatAbsoluteTime(r.at)}</TooltipContent>
              </Tooltip>
            </div>
            {r.note ? (
              <p className="text-muted-foreground mt-0.5 text-xs">{r.note}</p>
            ) : null}
          </li>
        ))}
      </ol>

      {hidden > 0 || expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show ${hidden} older`}
        </Button>
      ) : null}
    </div>
  )
}
