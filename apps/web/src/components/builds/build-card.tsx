import { Link } from "@tanstack/react-router"
import { Eye, Heart } from "lucide-react"

import type { BuildListItem } from "@/lib/builds-list-query"
import { relativeTime } from "@/lib/relative-time"
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
          className="absolute inset-0 h-full w-full object-cover"
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
          <span>{timeAgo}</span>
        </div>
      </div>
    </Link>
  )
}
