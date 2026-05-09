import { Link } from "@tanstack/react-router"
import { Eye, Heart } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { BuildListItem } from "@/lib/builds-list-query"
import { formatAbsoluteTime, relativeTime } from "@/lib/relative-time"
import { authorName } from "@/lib/user-display"
import { getImageUrl } from "@/lib/warframe"

export function BuildCard({ build }: { build: BuildListItem }) {
  const author = authorName(build.user)
  const timeAgo = relativeTime(build.updatedAt)

  return (
    <Link
      to="/builds/$slug"
      params={{ slug: build.slug }}
      className="bg-card hover:bg-card/80 block overflow-hidden rounded-lg border transition-colors"
    >
      <div className="bg-muted/20 relative aspect-video">
        <img
          src={getImageUrl(build.item.imageName ?? undefined)}
          alt={build.item.name}
          className="absolute inset-0 h-full w-full object-contain p-2"
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{build.name}</h3>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {build.item.name}
        </p>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {build.organization ? (
            <span className="text-[#a78bfa]">{build.organization.name}</span>
          ) : (
            <>by {author}</>
          )}
        </p>
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

export function BuildCardSkeleton() {
  return (
    <div className="bg-card block overflow-hidden rounded-lg border">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex flex-col gap-1 p-3">
        <Skeleton className="h-[1.125rem] w-3/4" />
        <Skeleton className="h-[0.875rem] w-1/2" />
        <Skeleton className="h-[0.875rem] w-2/5" />
        <div className="flex items-center justify-between pt-0.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}
