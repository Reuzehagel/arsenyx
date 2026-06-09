import { ExternalLink } from "lucide-react"

import { cn } from "@/lib/util/utils"

import { StatText } from "../stat-text"

export interface BuildItemDetailProps {
  name: string
  imageUrl: string
  /** Short qualifier line, e.g. "Rare · Madurai" (mods) or "Defensive" (arcanes). */
  meta?: string
  /** Rank as placed in the build. */
  rank: number
  /** Highest rank index (levelStats.length - 1). Adds "/ max" to the label. */
  maxRank?: number
  /** Stat lines at the placed rank. */
  stats: string[]
  /** Flavor/effect description. Only ~10% of mods ship one; arcanes none. */
  description?: string
  /** Wiki article URL — the authoritative "how to get it" reference. */
  wikiHref: string
  /** Warframe Market URL. Omitted for items we can't confirm are tradable. */
  marketHref?: string
}

/**
 * Read-only detail surface for a mod or arcane placed in a build. Rendered
 * inside the caller's PopoverContent (mod-slot / arcane), so it owns layout but
 * not the popover shell. View-mode only — never shown in the editor.
 */
export function BuildItemDetail({
  name,
  imageUrl,
  meta,
  rank,
  maxRank,
  stats,
  description,
  wikiHref,
  marketHref,
}: BuildItemDetailProps) {
  return (
    <div className="flex flex-col gap-3" style={{ maxWidth: 300 }}>
      <div className="flex items-center gap-3">
        <img
          src={imageUrl}
          alt=""
          className="size-12 shrink-0 rounded object-cover"
        />
        <div className="min-w-0">
          <p className="text-sm leading-tight font-semibold">{name}</p>
          {meta && (
            <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
              {meta}
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 text-[10px] uppercase">
            Rank {rank}
            {maxRank != null && maxRank > 0 ? ` / ${maxRank}` : ""}
          </p>
        </div>
      </div>

      {stats.length > 0 && (
        <p className="text-xs leading-relaxed opacity-80">
          <StatText text={stats.join("\n")} />
        </p>
      )}

      {description && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>
      )}

      <div className="border-t border-current/10 pt-2.5">
        <DetailLinks wikiHref={wikiHref} marketHref={marketHref} />
      </div>
    </div>
  )
}

/**
 * "How to get it" link row — Wiki (always) and Warframe Market (tradable only).
 * Shared by the arcane text card (BuildItemDetail) and the mod popover, which
 * renders it under a full ExpandedModCard.
 */
export function DetailLinks({
  wikiHref,
  marketHref,
}: {
  wikiHref: string
  marketHref?: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <DetailLink href={wikiHref}>Wiki</DetailLink>
      {marketHref && <DetailLink href={marketHref}>Market</DetailLink>}
    </div>
  )
}

function DetailLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "border-border bg-background/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
      )}
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  )
}
