import { useQuery } from "@tanstack/react-query"
import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import { ArrowLeft, ChevronDown, Search } from "lucide-react"
import { useMemo, useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { partnerBuildsQuery } from "@/lib/queries/partner-builds-query"
import { useItemImage } from "@/lib/use-item-image"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

import type { BuildTrailEntry } from "./build-trail"

// Below this count the strip is a single horizontal scroll row and the
// expand/search affordances stay hidden — a handful of chips don't need them.
const EXPAND_THRESHOLD = 4
// Only worth a filter box once the expanded grid gets long enough to scan.
const SEARCH_THRESHOLD = 8

/**
 * Related builds (currently: other builds linked as partners). Collapsed by
 * default into a horizontal scroll strip; past {@link EXPAND_THRESHOLD} a
 * toggle expands it into a wrap-grid of every partner, with a name filter once
 * the list is long. Renders nothing while loading or when there are no
 * partners. Lazy — only fetched when this strip mounts.
 *
 * When the viewer arrived by clicking a chip on another build (see
 * ./build-trail), that source build is pinned first with a back arrow. It goes
 * in this strip rather than a separate "back" section because the two overlap
 * heavily — mutually linked builds are the norm.
 */
export function RelatedBuildsStrip({
  slug,
  current,
}: {
  slug: string
  /** Summary of the build being viewed, stamped into history state by each
   *  chip so the destination can pin a way back. */
  current: BuildTrailEntry
}) {
  const { data: partners } = useQuery(partnerBuildsQuery(slug))
  const [expanded, setExpanded] = useState(false)
  const [q, setQ] = useState("")

  const from = useRouterState({ select: (s) => s.location.state.buildFrom })
  // A self-hop (build linked as its own partner) would pin a "back" link to
  // this very page.
  const source = from && from.slug !== slug ? from : undefined

  const rows = useMemo(
    () => mergeRows(slug, current, partners, source),
    [slug, current, partners, source],
  )

  const count = rows.length
  const canExpand = count > EXPAND_THRESHOLD
  // Fall back to the collapsed strip if the toggle is gone (partner count
  // dropped to the threshold after a refetch) so a stale `expanded` can't
  // trap the view in the grid with no way back.
  const isExpanded = expanded && canExpand
  const showSearch = isExpanded && count >= SEARCH_THRESHOLD

  const needle = q.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!needle) return rows
    return rows.filter(
      (r) =>
        r.build.name.toLowerCase().includes(needle) ||
        r.build.item.name.toLowerCase().includes(needle),
    )
  }, [rows, needle])

  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Related builds
        </h2>
        {canExpand ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
          >
            {expanded ? "Collapse" : `Show all ${count}`}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        ) : null}
      </div>

      {showSearch ? (
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Filter related builds…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </InputGroup>
      ) : null}

      {isExpanded ? (
        shown.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            No related builds match “{q.trim()}”.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-2">
            {shown.map((r) => (
              <li key={r.build.slug}>
                <RelatedBuildChip {...r} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {rows.map((r) => (
            <li key={r.build.slug} className="w-80 shrink-0">
              <RelatedBuildChip {...r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One chip in the merged strip. `build` is the destination; `from` is the hop
 *  stamped into history state when it's clicked. The pinned source build is
 *  the row with no `from` (see mergeRows) and renders as the back link. */
type Row = {
  build: BuildTrailEntry
  from?: BuildTrailEntry
}

/**
 * Compose the strip: the build we hopped from (pinned first), then this
 * build's own partners. De-duplicated by slug — a mutually linked source would
 * otherwise appear twice — and never includes the build being viewed.
 */
function mergeRows(
  slug: string,
  current: BuildTrailEntry,
  partners: BuildTrailEntry[] | undefined,
  source: BuildTrailEntry | undefined,
): Row[] {
  const rows: Row[] = []
  const seen = new Set([slug])
  const push = (row: Row) => {
    if (seen.has(row.build.slug)) return
    seen.add(row.build.slug)
    rows.push(row)
  }

  // Not stamping a hop on the back link: the source's page already lists this
  // build as a partner, so the pair would just ping-pong.
  if (source) push({ build: source })
  for (const p of partners ?? []) push({ build: p, from: current })
  return rows
}

function RelatedBuildChip({ build, from }: Row) {
  const itemImage = useItemImage()
  const back = !from
  return (
    <RouterLink
      to="/builds/$slug"
      params={{ slug: build.slug }}
      // Owner-chosen variant target (issue #302) — the viewer clamps an
      // index that no longer exists, so a stale target degrades to variant 0.
      search={build.variant ? { v: build.variant } : {}}
      state={from ? (prev) => ({ ...prev, buildFrom: from }) : undefined}
      title={back ? `Back to ${build.name}` : build.name}
      className={cn(
        "bg-card hover:bg-card/70 flex w-full items-center gap-3 rounded-md border py-2 pr-4 pl-2 transition-colors",
        back && "border-primary/40",
      )}
    >
      <span className="bg-muted/40 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded">
        <img
          src={getImageUrl(
            itemImage(build.item.uniqueName, build.item.imageName),
          )}
          alt=""
          className="size-full object-contain"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {back ? (
            <ArrowLeft className="text-muted-foreground size-3.5 shrink-0" />
          ) : null}
          <span className="truncate">{build.name}</span>
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {build.item.name}
        </span>
      </span>
    </RouterLink>
  )
}
