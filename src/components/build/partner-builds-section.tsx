import { Gem } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { getImageUrl } from "@/lib/warframe"

export interface VisiblePartnerBuild {
  id: string
  slug: string
  name: string
  isDeleted?: boolean
  item?: {
    name: string
    imageName: string | null
    browseCategory: string
  }
  buildData?: {
    formaCount?: number
  }
}

interface PartnerBuildsSectionProps {
  partnerBuilds: VisiblePartnerBuild[]
  className?: string
}

export function PartnerBuildsSection({
  partnerBuilds,
  className,
}: PartnerBuildsSectionProps) {
  // Filter out any that shouldn't be shown (this is a safety check,
  // visibility filtering should happen server-side)
  const visibleBuilds = partnerBuilds.filter(
    (build) => build.isDeleted || (build.item && build.buildData),
  )

  if (visibleBuilds.length === 0) {
    return null
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <h3 className="text-muted-foreground text-sm font-medium">
        Partner Builds
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleBuilds.map((build) =>
          build.isDeleted ? (
            <DeletedPartnerCard key={build.id} />
          ) : (
            <PartnerBuildViewCard key={build.id} build={build} />
          ),
        )}
      </div>
    </div>
  )
}

interface PartnerBuildViewCardProps {
  build: VisiblePartnerBuild
}

function PartnerBuildViewCard({ build }: PartnerBuildViewCardProps) {
  if (!build.item || !build.buildData) {
    return null
  }

  const imageUrl = getImageUrl(build.item.imageName ?? undefined)
  const formaCount = build.buildData.formaCount ?? 0

  return (
    <Link
      href={`/builds/${build.slug}`}
      className="group bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-2 transition-colors"
    >
      {/* Item image */}
      <div className="bg-muted/50 relative size-10 shrink-0 overflow-hidden rounded">
        <Image
          src={imageUrl}
          alt={build.item.name}
          fill
          sizes="40px"
          className="object-cover transition-transform group-hover:scale-110"
          unoptimized
        />
      </div>

      {/* Build info */}
      <div className="min-w-0 flex-1">
        <p className="group-hover:text-primary truncate text-sm font-medium transition-colors">
          {build.name}
        </p>
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
    </Link>
  )
}

function DeletedPartnerCard() {
  return (
    <Alert className="opacity-60">
      <AlertDescription>Build no longer available</AlertDescription>
    </Alert>
  )
}
