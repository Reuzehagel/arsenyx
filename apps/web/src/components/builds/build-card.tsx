import { Link } from "@tanstack/react-router"
import { Eye, Heart } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { BuildListItem } from "@/lib/queries/builds-list-query"
import { useItemImage } from "@/lib/use-item-image"
import { formatAbsoluteTime, relativeTime } from "@/lib/util/relative-time"
import { authorName } from "@/lib/util/user-display"
import { getImageUrl } from "@/lib/warframe"

/** Shared per-card derivation: relative timestamp and the current catalog
 *  image URL resolved from the build's item. (Author is derived in
 *  BuildByline, the only place it's rendered.) */
function useBuildCardData(build: BuildListItem) {
  const itemImage = useItemImage()
  return {
    timeAgo: relativeTime(build.updatedAt),
    imageUrl: getImageUrl(
      itemImage(build.item.uniqueName, build.item.imageName),
    ),
  }
}

/** Byline line(s) crediting the org and/or author. `card` stacks two <p> rows
 *  (org line + author line) to keep card heights aligned; `row` renders the
 *  inline "· by …" variant used in the dense row layout. */
function BuildByline({
  build,
  variant,
}: {
  build: BuildListItem
  variant: "card" | "row"
}) {
  const author = authorName(build.user)

  if (variant === "card") {
    return (
      <>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {build.organization ? (
            <span className="text-wf-org">{build.organization.name}</span>
          ) : (
            <>by {author}</>
          )}
        </p>
        <p
          className="text-muted-foreground line-clamp-1 text-xs"
          aria-hidden={!build.organization || build.hideAuthor}
        >
          {build.organization && !build.hideAuthor ? (
            <>by {author}</>
          ) : (
            <>&nbsp;</>
          )}
        </p>
      </>
    )
  }

  return build.organization ? (
    <>
      <span className="text-wf-org line-clamp-1">
        {build.organization.name}
      </span>
      {!build.hideAuthor && (
        <>
          <span aria-hidden>·</span>
          <span className="line-clamp-1">by {author}</span>
        </>
      )}
    </>
  ) : (
    <span className="line-clamp-1">by {author}</span>
  )
}

export function BuildCard({ build }: { build: BuildListItem }) {
  const { timeAgo, imageUrl } = useBuildCardData(build)

  return (
    <Link
      to="/builds/$slug"
      params={{ slug: build.slug }}
      className="bg-card hover:bg-card/80 block overflow-hidden rounded-lg border transition-colors"
    >
      <div className="bg-muted/20 relative aspect-video">
        <img
          src={imageUrl}
          alt={build.item.name}
          className="absolute inset-0 h-full w-full object-contain p-2"
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold" title={build.name}>
          {build.name}
        </h3>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {build.item.name}
        </p>
        <BuildByline build={build} variant="card" />
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Heart className="size-3" />
              <span className="tabular-nums">{build.likeCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {build.viewCount}
            </span>
          </span>
          <Tooltip>
            <TooltipTrigger render={<span>{timeAgo}</span>} />
            <TooltipContent>
              Updated {formatAbsoluteTime(build.updatedAt)}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Link>
  )
}

export function BuildRow({ build }: { build: BuildListItem }) {
  const { timeAgo, imageUrl } = useBuildCardData(build)

  return (
    <Link
      to="/builds/$slug"
      params={{ slug: build.slug }}
      className="bg-card hover:bg-card/80 flex items-center gap-3 overflow-hidden rounded-lg border p-2 transition-colors sm:gap-4 sm:p-3"
    >
      <div className="bg-muted/20 relative size-14 shrink-0 overflow-hidden rounded-md sm:size-16">
        <img
          src={imageUrl}
          alt={build.item.name}
          className="absolute inset-0 h-full w-full object-contain p-1"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold sm:text-base">
          {build.name}
        </h3>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          <span className="line-clamp-1">{build.item.name}</span>
          <span aria-hidden>·</span>
          <BuildByline build={build} variant="row" />
        </div>
      </div>
      <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <Heart className="size-3" />
          <span className="tabular-nums">{build.likeCount}</span>
        </span>
        <span className="flex items-center gap-1">
          <Eye className="size-3" />
          <span className="tabular-nums">{build.viewCount}</span>
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="hidden w-12 text-right sm:inline">
                {timeAgo}
              </span>
            }
          />
          <TooltipContent>
            Updated {formatAbsoluteTime(build.updatedAt)}
          </TooltipContent>
        </Tooltip>
      </div>
    </Link>
  )
}

export function BuildRowSkeleton() {
  return (
    <div className="bg-card flex items-center gap-3 overflow-hidden rounded-lg border p-2 sm:gap-4 sm:p-3">
      <Skeleton className="size-14 shrink-0 rounded-md sm:size-16" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="hidden h-3 w-12 sm:block" />
      </div>
    </div>
  )
}

export function BuildCardSkeleton() {
  return (
    <div className="bg-card block overflow-hidden rounded-lg border">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex flex-col gap-1 p-3">
        <Skeleton className="h-[1.125rem] w-3/4" />
        <Skeleton className="h-[0.875rem] w-1/2" />
        <Skeleton className="h-[0.875rem] w-2/5" />
        <Skeleton className="h-[0.875rem] w-1/3" />
        <div className="flex items-center justify-between pt-0.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}
