import { useQuery } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"
import { ChevronDown, Search } from "lucide-react"
import { useMemo, useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  partnerBuildsQuery,
  type PartnerBuild,
} from "@/lib/queries/partner-builds-query"
import { useItemImage } from "@/lib/use-item-image"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

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
 */
export function RelatedBuildsStrip({ slug }: { slug: string }) {
  const { data: partners } = useQuery(partnerBuildsQuery(slug))
  const [expanded, setExpanded] = useState(false)
  const [q, setQ] = useState("")

  const count = partners?.length ?? 0
  const canExpand = count > EXPAND_THRESHOLD
  // Fall back to the collapsed strip if the toggle is gone (partner count
  // dropped to the threshold after a refetch) so a stale `expanded` can't
  // trap the view in the grid with no way back.
  const isExpanded = expanded && canExpand
  const showSearch = isExpanded && count >= SEARCH_THRESHOLD

  const needle = q.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!partners) return []
    if (!needle) return partners
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.item.name.toLowerCase().includes(needle),
    )
  }, [partners, needle])

  if (!partners || partners.length === 0) return null

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
            {shown.map((p) => (
              <li key={p.id}>
                <RelatedBuildChip build={p} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {partners.map((p) => (
            <li key={p.id} className="w-80 shrink-0">
              <RelatedBuildChip build={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RelatedBuildChip({ build }: { build: PartnerBuild }) {
  const itemImage = useItemImage()
  return (
    <RouterLink
      to="/builds/$slug"
      params={{ slug: build.slug }}
      title={build.name}
      className="bg-card hover:bg-card/70 flex w-full items-center gap-3 rounded-md border py-2 pr-4 pl-2 transition-colors"
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
        <span className="truncate text-sm font-medium">{build.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {build.item.name}
        </span>
      </span>
    </RouterLink>
  )
}
