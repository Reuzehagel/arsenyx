/* PROTOTYPE — issue #331. Variant B: no new surface, the existing header
 * timestamp becomes the affordance. */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatAbsoluteTime, relativeTime } from "@/lib/util/relative-time"

import { PROTO_REVISIONS } from "./stub-data"

/**
 * Variant B — the header's "Updated 2d ago" text turns into a popover trigger
 * listing recent saves. Zero page footprint and nothing new to notice, at the
 * cost of discoverability: the only hint is a dotted underline. Replaces the
 * plain timestamp in viewer-header.tsx rather than sitting next to it.
 */
export function VariantBTrigger({ updatedAt }: { updatedAt: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="decoration-muted-foreground/60 hover:text-foreground cursor-pointer underline decoration-dotted underline-offset-2"
          />
        }
      >
        Updated {relativeTime(updatedAt)}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <div className="flex items-baseline gap-2 px-3 pt-3 pb-2">
          <span className="text-sm font-medium">Edit history</span>
          <span className="text-muted-foreground text-xs">
            {PROTO_REVISIONS.length} edits
          </span>
        </div>
        <ol className="max-h-72 overflow-y-auto px-3 pb-3">
          {PROTO_REVISIONS.map((r) => (
            <li
              key={r.id}
              className="border-border/50 flex flex-col gap-0.5 border-t py-2 first:border-t-0 first:pt-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium">
                  {r.editor.name}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="text-muted-foreground shrink-0 cursor-default text-[11px]">
                        {relativeTime(r.at)}
                      </span>
                    }
                  />
                  <TooltipContent>{formatAbsoluteTime(r.at)}</TooltipContent>
                </Tooltip>
              </div>
              {r.note ? (
                <p className="text-muted-foreground text-[11px] leading-snug">
                  {r.note}
                </p>
              ) : (
                <p className="text-muted-foreground/60 text-[11px] italic">
                  {r.kind === "created" ? "created the build" : "no note"}
                </p>
              )}
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground/70 border-t px-3 py-2 text-[11px]">
          Only visible to people who can edit this build
        </p>
      </PopoverContent>
    </Popover>
  )
}
