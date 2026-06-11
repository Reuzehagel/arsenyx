import { useEffect, useRef, useState, type ReactNode } from "react"

// Deep imports (not the build-editor barrel) so this stays safe to pull into
// the embed bundle — same rule as build-viewer-body.
import {
  BuildItemDetail,
  DetailLinks,
} from "@/components/build-editor/item-detail"
import { ModCard } from "@/components/build-editor/mod-card"
import {
  arcaneMaxRank,
  arcaneStatsAt,
} from "@/components/build-editor/slot-ranks"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { GuideRefTarget } from "@/lib/guide-refs"
import { DISPLAY_SIZE } from "@/lib/mod-card-config"
import { useModMarketHref } from "@/lib/queries/mod-tradable-query"
import { getArcaneImageUrl } from "@/lib/util/arcane-images"
import { marketUrl, wikiUrl } from "@/lib/util/warframe-links"

const HOVER_OPEN_MS = 150
const HOVER_CLOSE_MS = 250

/**
 * Inline mod/arcane reference inside guide markdown (issue #228). Renders the
 * link text; hovering (desktop) or tapping (mobile) opens a detail popover —
 * the full expanded mod card, or the arcane text card — with Wiki/Market
 * links, mirroring what clicking a build slot shows in view mode.
 *
 * Hover uses an intent delay on both trigger and content so the pointer can
 * travel into the card without it closing; click toggles, and the Popover
 * itself handles outside-click/Escape dismissal for the tap path.
 */
export function GuideRefLink({
  target,
  children,
}: {
  target: GuideRefTarget
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const schedule = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), delay)
  }
  const cancel = () => window.clearTimeout(timer.current)
  // A pending hover timer must not fire setOpen after unmount (variant
  // switch / guide re-render while the pointer is mid-hover).
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const name = target.kind === "mod" ? target.mod.name : target.arcane.name

  // Market link: mods gate on the lazily-fetched non-tradable index (same
  // hook as the slot detail popover); arcanes carry `tradable` inline.
  const modMarketHref = useModMarketHref(
    target.kind === "mod" ? target.mod : undefined,
    open,
  )
  const marketHref =
    target.kind === "mod"
      ? modMarketHref
      : target.arcane.tradable
        ? marketUrl(name)
        : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span
            role="button"
            tabIndex={0}
            className="text-primary cursor-pointer underline decoration-dotted underline-offset-2"
          />
        }
        onMouseEnter={() => schedule(true, HOVER_OPEN_MS)}
        onMouseLeave={() => schedule(false, HOVER_CLOSE_MS)}
        onClick={() => {
          cancel()
          setOpen((o) => !o)
        }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-auto"
        onMouseEnter={cancel}
        onMouseLeave={() => schedule(false, HOVER_CLOSE_MS)}
      >
        {target.kind === "mod" ? (
          <div
            className="flex flex-col items-center gap-2"
            style={{ width: DISPLAY_SIZE.expanded.width }}
          >
            <div style={{ height: DISPLAY_SIZE.expanded.height }}>
              <ModCard mod={target.mod} alwaysExpanded />
            </div>
            <DetailLinks wikiHref={wikiUrl(name)} marketHref={marketHref} />
          </div>
        ) : (
          <BuildItemDetail
            name={name}
            imageUrl={getArcaneImageUrl(target.arcane.imageName)}
            meta={target.arcane.type}
            rank={arcaneMaxRank(target.arcane)}
            maxRank={arcaneMaxRank(target.arcane)}
            stats={arcaneStatsAt(target.arcane, arcaneMaxRank(target.arcane))}
            description={target.arcane.description}
            wikiHref={wikiUrl(name)}
            marketHref={marketHref}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
