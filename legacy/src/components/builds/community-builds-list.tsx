"use client"

import Image from "next/image"
import Link from "next/link"

import { BuildStats } from "@/components/build/build-card-link"
import { BuildList, useBuildLayout } from "@/components/build/build-list"
import { Badge } from "@/components/ui/badge"
import type { BuildListItem } from "@/lib/db/index"
import { getCategoryConfig } from "@/lib/warframe/categories"
import { getImageUrl } from "@/lib/warframe/images"
import type { BrowseCategory } from "@/lib/warframe/types"

// Simple relative time formatting
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function CommunityBuildCard({
  build,
  layout,
}: {
  build: BuildListItem
  layout: "grid" | "list"
}) {
  const timeAgo = getRelativeTime(new Date(build.createdAt))
  const categoryLabel =
    getCategoryConfig(build.item.browseCategory as BrowseCategory)?.label ??
    build.item.browseCategory
  const authorName =
    build.user.displayUsername ||
    build.user.username ||
    build.user.name ||
    "Anonymous"

  if (layout === "grid") {
    return (
      <Link
        href={`/builds/${build.slug}`}
        className="bg-card hover:bg-card/80 block overflow-hidden rounded-lg border transition-colors"
      >
        <div className="bg-muted/20 relative aspect-video">
          <Image
            src={getImageUrl(build.item.imageName ?? undefined)}
            alt={build.item.name}
            fill
            unoptimized
            sizes="(max-width: 768px) 50vw, 300px"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-1 p-2">
          <h3 className="line-clamp-1 text-sm font-semibold">{build.name}</h3>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {build.item.name}
          </p>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {build.organization ? (
              <span className="text-[#a78bfa]">
                {build.organization.name}
              </span>
            ) : (
              <>by {authorName}</>
            )}
          </p>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <BuildStats
              voteCount={build.voteCount}
              viewCount={build.viewCount}
            />
            <span>{timeAgo}</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="bg-card hover:bg-card/80 relative flex items-center gap-4 rounded-lg border p-4 transition-colors">
      <Link
        href={`/builds/${build.slug}`}
        className="absolute inset-0 rounded-lg"
        aria-label={build.name}
      />
      <div className="bg-muted/20 relative size-20 shrink-0 overflow-hidden rounded-lg">
        <Image
          src={getImageUrl(build.item.imageName ?? undefined)}
          alt={build.item.name}
          fill
          unoptimized
          sizes="80px"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate text-base font-semibold">{build.name}</h3>
        <p className="text-muted-foreground text-sm">
          {build.item.name} build by{" "}
          {build.organization ? (
            <Link
              href={`/org/${build.organization.slug}`}
              className="relative z-10 text-[#a78bfa] underline decoration-[#a78bfa]/40 hover:decoration-[#a78bfa]"
            >
              {build.organization.name}
            </Link>
          ) : (
            <Link
              href={`/profile/${build.user.username || ""}`}
              className="relative z-10 underline decoration-current/40 hover:decoration-current"
            >
              {authorName}
            </Link>
          )}
        </p>
        <div className="flex gap-2 pt-1">
          <Badge variant="secondary" className="text-xs">
            {timeAgo}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {categoryLabel}
          </Badge>
        </div>
      </div>
      <div className="shrink-0 pl-4">
        <BuildStats voteCount={build.voteCount} viewCount={build.viewCount} />
      </div>
    </div>
  )
}

export function CommunityBuildsList({
  builds,
  count,
}: {
  builds: BuildListItem[]
  count: number
}) {
  const layout = useBuildLayout()

  return (
    <BuildList count={count}>
      {builds.map((build) => (
        <CommunityBuildCard key={build.id} build={build} layout={layout} />
      ))}
    </BuildList>
  )
}
