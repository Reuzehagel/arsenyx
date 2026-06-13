import { type ReactElement, type ReactNode, useState } from "react"

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

/**
 * A trigger that shows a hover **tooltip** on desktop and opens a tap **popover**
 * on touch, sharing one anchor element through Base UI's nested-trigger
 * composition (`TooltipTrigger render={<PopoverTrigger render={trigger} />}`).
 * That nesting is fiddly and was copy-pasted across the embed strips and the
 * helminth picker — this single-sources it.
 *
 * By default the popover shows the same body as the tooltip (the tap-friendly
 * view of the same info), so most callers pass only `tooltip`. Pass `popover`
 * for a distinct interactive body; it receives a `close` callback. Set
 * `interactive={false}` for a slot that should only ever show the tooltip (e.g.
 * an empty or unselected slot): the popover is dropped and the trigger renders
 * bare, with no `PopoverTrigger` wrapper. (A `popover` passed alongside
 * `interactive={false}` is intentionally ignored — the slot has no popover.)
 *
 * Placement is fixed: tooltip + popover both `side="bottom"`, popover
 * `align="center"`. The editor's `shard-controls` / `incarnon-controls` keep
 * their own inline composition on purpose: their popover is a bespoke
 * interactive picker whose placement varies (the editing view opens to the
 * side), which this fixed single-placement contract doesn't cover.
 */
export function TapPopover({
  trigger,
  tooltip,
  popover,
  interactive = true,
  tooltipClassName,
  popoverClassName,
}: {
  /** The element that is both the hover anchor and the tap trigger. Must be a
   *  single element — Base UI's `render` clones it. */
  trigger: ReactElement
  /** Hover-tooltip body; also the popover body when `popover` is omitted. */
  tooltip: ReactNode
  /** Distinct tap-popover body; receives a `close` callback. Ignored when
   *  `interactive` is false. */
  popover?: (close: () => void) => ReactNode
  /** When false, only the tooltip shows (no popover, bare trigger). */
  interactive?: boolean
  tooltipClassName?: string
  popoverClassName?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={interactive ? setOpen : undefined}>
      <Tooltip>
        <TooltipTrigger
          render={interactive ? <PopoverTrigger render={trigger} /> : trigger}
        />
        <TooltipContent side="bottom" className={tooltipClassName}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
      {interactive && (
        <PopoverContent
          side="bottom"
          align="center"
          className={popoverClassName}
        >
          {popover ? popover(() => setOpen(false)) : tooltip}
        </PopoverContent>
      )}
    </Popover>
  )
}
