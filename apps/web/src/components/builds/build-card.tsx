import type { BuildListItemResponse } from "@arsenyx/shared/api/build-dto"
import { getCategoryLabel } from "@arsenyx/shared/warframe/categories"
import { Link } from "@tanstack/react-router"
import { Eye, Heart } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useItemImage } from "@/lib/hooks/use-item-image"
import { getImageUrl } from "@/lib/image-url"
import { formatAbsoluteTime, relativeTime } from "@/lib/util/relative-time"
import { authorName } from "@/lib/util/user-display"

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** Like/view count: compact ("1.3K") so big numbers don't crowd the title;
 *  the exact figure is in the tooltip. */
function Count({ value }: { value: number }) {
  return (
    <span className="tabular-nums" title={value.toLocaleString("en-US")}>
      {compactFormat.format(value)}
    </span>
  )
}

/** Item image that falls back to the placeholder when the URL 404s (e.g. a
 *  removed item whose stored image is gone). */
function ItemImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        e.currentTarget.src = getImageUrl()
      }}
    />
  )
}

/** Shared per-card derivation: relative timestamp and the current catalog
 *  image URL resolved from the build's item. (Author is derived in
 *  BuildByline, the only place it's rendered.) */
function useBuildCardData(build: BuildListItemResponse) {
  const itemImage = useItemImage()
  return {
    timeAgo: relativeTime(build.updatedAt),
    imageUrl: getImageUrl(
      itemImage(build.item.uniqueName, build.item.imageName),
    ),
  }
}

/** One-line byline: "Org · by author", "Org", or "by author". Each part
 *  truncates on its own; the caller supplies the flex row. */
function BuildByline({ build }: { build: BuildListItemResponse }) {
  const author = authorName(build.user)

  return build.organization ? (
    <>
      <span
        className={`min-w-0 truncate ${build.organization.verified ? "text-wf-org" : ""}`}
        title={build.organization.name}
      >
        {build.organization.name}
      </span>
      {!build.hideAuthor && (
        <>
          <span aria-hidden className="shrink-0">
            ·
          </span>
          <span className="min-w-0 truncate" title={`by ${author}`}>
            by {author}
          </span>
        </>
      )}
    </>
  ) : (
    <span className="min-w-0 truncate" title={`by ${author}`}>
      by {author}
    </span>
  )
}

/** Forma count on a build card. Hidden at 0 (a no-forma build), matching the
 *  viewer's EndoFormaBadges behaviour. Uses the Forma currency icon rather than
 *  a lucide glyph so it reads as the in-game resource at a glance. `withDivider`
 *  prepends a hairline rule (card layout sets forma apart from the social stats;
 *  the dense row omits it) — kept here so the show-at-all rule lives in one place. */
function FormaStat({
  count,
  withDivider,
}: {
  count: number
  withDivider?: boolean
}) {
  // `!(count > 0)` (not `count <= 0`) so a missing/undefined count — e.g. a
  // stale React Query cache entry serialized before this field shipped — hides
  // the badge instead of rendering "undefined forma".
  if (!(count > 0)) return null
  return (
    <>
      {withDivider && <span aria-hidden className="bg-border h-3 w-px" />}
      <span className="flex items-center gap-1" title={`${count} forma`}>
        <img
          src="/icons/currency/Forma.png"
          alt=""
          aria-hidden
          className="size-3 object-contain"
        />
        <span className="tabular-nums">{count}</span>
      </span>
    </>
  )
}

/** Item name under the build title — or its category when the build is just
 *  named after the item, so cards don't read "Furis / Furis". */
function itemSubtitle(build: BuildListItemResponse): string {
  return build.name.trim() === build.item.name
    ? getCategoryLabel(build.item.category)
    : build.item.name
}

export function BuildCard({ build }: { build: BuildListItemResponse }) {
  const { timeAgo, imageUrl } = useBuildCardData(build)

  return (
    <Link
      to="/builds/$slug"
      params={{ slug: build.slug }}
      className="bg-card hover:bg-card/80 ease-snappy block overflow-hidden rounded-lg border transition-[background-color,scale] duration-150 active:scale-[0.98] motion-reduce:active:scale-100"
    >
      <div className="bg-muted/20 relative aspect-video">
        <ItemImage
          src={imageUrl}
          alt={build.item.name}
          className="absolute inset-0 h-full w-full object-contain p-2"
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-semibold" title={build.name}>
          {build.name}
        </h3>
        {/* The date shares the item line so the stats row below has room for
            likes, views and forma on one line even at worst-case counts. */}
        <div className="text-muted-foreground flex items-center justify-between gap-x-2 text-xs">
          <span className="min-w-0 truncate">{itemSubtitle(build)}</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="shrink-0 whitespace-nowrap">{timeAgo}</span>
              }
            />
            <TooltipContent className="data-instant:animate-none!">
              Updated {formatAbsoluteTime(build.updatedAt)}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="text-muted-foreground flex min-w-0 items-center gap-x-1.5 text-xs">
          <BuildByline build={build} />
        </div>
        <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className="flex items-center gap-1">
            <Heart className="size-3" />
            <Count value={build.likeCount} />
          </span>
          <span className="flex items-center gap-1">
            <Eye className="size-3" />
            <Count value={build.viewCount} />
          </span>
          {/* Divider sets forma (a build property) apart from likes/views
              (social signals) without the noise of a thumbnail overlay. */}
          <FormaStat count={build.formaCount} withDivider />
        </div>
      </div>
    </Link>
  )
}

export function BuildRow({ build }: { build: BuildListItemResponse }) {
  const { timeAgo, imageUrl } = useBuildCardData(build)

  return (
    <Link
      to="/builds/$slug"
      params={{ slug: build.slug }}
      className="bg-card hover:bg-card/80 ease-snappy flex items-center gap-3 overflow-hidden rounded-lg border p-2 transition-[background-color,scale] duration-150 active:scale-[0.99] motion-reduce:active:scale-100 sm:gap-4 sm:p-3"
    >
      <div className="bg-muted/20 relative size-14 shrink-0 overflow-hidden rounded-md sm:size-16">
        <ItemImage
          src={imageUrl}
          alt={build.item.name}
          className="absolute inset-0 h-full w-full object-contain p-1"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3
          className="truncate text-sm font-semibold sm:text-base"
          title={build.name}
        >
          {build.name}
        </h3>
        {/* One line: each part truncates instead of wrapping, so a "·" is
            never stranded at a line start. */}
        <div className="text-muted-foreground flex min-w-0 items-center gap-x-2 text-xs">
          <span className="max-w-[40%] shrink-0 truncate">
            {itemSubtitle(build)}
          </span>
          <span aria-hidden className="shrink-0">
            ·
          </span>
          <BuildByline build={build} />
        </div>
      </div>
      <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <Heart className="size-3" />
          <Count value={build.likeCount} />
        </span>
        {/* Views drop on phones: likes and forma matter more there. */}
        <span className="hidden items-center gap-1 sm:flex">
          <Eye className="size-3" />
          <Count value={build.viewCount} />
        </span>
        <FormaStat count={build.formaCount} />
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="hidden w-12 text-right sm:inline">
                {timeAgo}
              </span>
            }
          />
          <TooltipContent className="data-instant:animate-none!">
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
        <div className="flex items-center justify-between">
          <Skeleton className="h-[0.875rem] w-1/2" />
          <Skeleton className="h-[0.875rem] w-10" />
        </div>
        <Skeleton className="h-[0.875rem] w-2/5" />
        <Skeleton className="mt-0.5 h-3 w-24" />
      </div>
    </div>
  )
}
