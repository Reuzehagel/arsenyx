"use client"

import { BuildCardLink } from "@/components/build/build-card-link"
import { BuildList, useBuildLayout } from "@/components/build/build-list"

interface FavoriteBuild {
  id: string
  slug: string
  name: string
  item: { name: string; imageName: string | null }
  voteCount: number
  viewCount: number
  user: {
    displayUsername: string | null
    username: string | null
    name: string | null
  }
}

export function FavoriteBuildsList({ builds }: { builds: FavoriteBuild[] }) {
  const layout = useBuildLayout()

  return (
    <BuildList>
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
          subtitle={
            layout === "list" ? (
              <p className="text-muted-foreground line-clamp-1 text-sm">
                {build.item.name} by{" "}
                {build.user.displayUsername ||
                  build.user.username ||
                  build.user.name ||
                  "Anonymous"}
              </p>
            ) : undefined
          }
        />
      ))}
    </BuildList>
  )
}
