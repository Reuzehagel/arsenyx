import { ThumbsUp, Eye } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { getImageUrl } from "@/lib/warframe/images"

interface BuildCardLinkProps {
  slug: string
  name: string
  itemName: string
  itemImageName: string | null
  voteCount: number
  viewCount: number
  /** Optional content rendered over the image (e.g. visibility badge) */
  imageOverlay?: ReactNode
  /** Optional subtitle line (e.g. "by username") */
  subtitle?: ReactNode
  /** Optional extra content after stats */
  footer?: ReactNode
}

export function BuildCardLink({
  slug,
  name,
  itemName,
  itemImageName,
  voteCount,
  viewCount,
  imageOverlay,
  subtitle,
  footer,
}: BuildCardLinkProps) {
  return (
    <Link
      href={`/builds/${slug}`}
      className="bg-card hover:border-primary block overflow-hidden rounded-lg border transition-colors"
    >
      <div className="bg-muted/20 relative aspect-video">
        <Image
          src={getImageUrl(itemImageName ?? undefined)}
          alt={itemName}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover"
        />
        {imageOverlay}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <h3 className="line-clamp-1 text-sm font-medium">{name}</h3>
        {subtitle ?? (
          <p className="text-muted-foreground text-xs">{itemName}</p>
        )}
        <BuildStats voteCount={voteCount} viewCount={viewCount} />
        {footer}
      </div>
    </Link>
  )
}

export function BuildStats({
  voteCount,
  viewCount,
}: {
  voteCount: number
  viewCount: number
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <span className="flex items-center gap-0.5">
        <ThumbsUp className="size-3" />
        {voteCount}
      </span>
      <span className="flex items-center gap-0.5">
        <Eye className="size-3" />
        {viewCount}
      </span>
    </div>
  )
}
