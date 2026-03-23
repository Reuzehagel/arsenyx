"use client"

import { X, Gem } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getImageUrl } from "@/lib/warframe"
export interface PartnerBuild {
  id: string
  slug: string
  name: string
  item: {
    name: string
    imageName: string | null
    browseCategory: string
  }
  buildData: {
    formaCount?: number
  }
}

interface PartnerBuildCardProps {
  build: PartnerBuild
  onRemove?: () => void
  isEditable?: boolean
  className?: string
}

export function PartnerBuildCard({
  build,
  onRemove,
  isEditable = false,
  className,
}: PartnerBuildCardProps) {
  const imageUrl = getImageUrl(build.item.imageName ?? undefined)
  const formaCount = build.buildData?.formaCount ?? 0

  const content = (
    <div
      className={cn(
        "bg-card relative flex items-center gap-3 rounded-lg border p-2 transition-colors",
        !isEditable && "hover:bg-accent/50 cursor-pointer",
        className,
      )}
    >
      {/* Item image */}
      <div className="bg-muted/50 relative size-10 shrink-0 overflow-hidden rounded">
        <Image
          src={imageUrl}
          alt={build.item.name}
          fill
          sizes="40px"
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Build info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{build.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {build.item.name}
        </p>
      </div>

      {/* Forma count */}
      {formaCount > 0 && (
        <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
          <Gem className="size-3" />
          <span>{formaCount}</span>
        </div>
      )}

      {/* Remove button */}
      {isEditable && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive h-6 w-6 shrink-0"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="size-3" />
          <span className="sr-only">Remove partner build</span>
        </Button>
      )}
    </div>
  )

  if (isEditable) {
    return content
  }

  return (
    <Link href={`/builds/${build.slug}`} className="block">
      {content}
    </Link>
  )
}

interface DeletedPartnerCardProps {
  className?: string
}

export function DeletedPartnerCard({ className }: DeletedPartnerCardProps) {
  return (
    <div
      className={cn(
        "bg-muted/30 flex items-center gap-3 rounded-lg border p-2 opacity-60",
        className,
      )}
    >
      <div className="bg-muted/50 flex size-10 shrink-0 items-center justify-center rounded">
        <X className="text-muted-foreground size-4" />
      </div>
      <p className="text-muted-foreground text-sm">Build no longer available</p>
    </div>
  )
}
