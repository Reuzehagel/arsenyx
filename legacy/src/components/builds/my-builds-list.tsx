"use client"

import type { BuildVisibility } from "@/generated/prisma/client"
import { Globe, Link as LinkIcon, Lock } from "lucide-react"

import { BuildCardLink } from "@/components/build/build-card-link"
import { BuildList, useBuildLayout } from "@/components/build/build-list"
import { Badge } from "@/components/ui/badge"

interface MyBuild {
  id: string
  slug: string
  name: string
  item: { name: string; imageName: string | null }
  voteCount: number
  viewCount: number
  visibility: BuildVisibility
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const icon =
    visibility === "PRIVATE" ? (
      <Lock className="size-3" />
    ) : visibility === "UNLISTED" ? (
      <LinkIcon className="size-3" />
    ) : (
      <Globe className="size-3" />
    )

  const label =
    visibility === "PRIVATE"
      ? "Private"
      : visibility === "UNLISTED"
        ? "Unlisted"
        : "Public"

  return (
    <div className="absolute top-2 right-2">
      <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 text-xs">
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </Badge>
    </div>
  )
}

export function MyBuildsList({ builds }: { builds: MyBuild[] }) {
  const layout = useBuildLayout()

  return (
    <BuildList showToolbar={false}>
      {builds.map((build) => (
        <BuildCardLink
          key={build.id}
          slug={build.slug}
          name={build.name}
          itemName={build.item.name}
          itemImageName={build.item.imageName}
          voteCount={build.voteCount}
          viewCount={build.viewCount}
          layout={layout}
          imageOverlay={<VisibilityBadge visibility={build.visibility} />}
        />
      ))}
    </BuildList>
  )
}
