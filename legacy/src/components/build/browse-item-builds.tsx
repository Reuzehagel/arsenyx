"use client"

import { BuildCardLink } from "@/components/build/build-card-link"
import { BuildList, useBuildLayout } from "@/components/build/build-list"
import { OrgBadge } from "@/components/org"

interface BrowseItemBuild {
  id: string
  slug: string
  name: string
  item: { name: string; imageName: string | null }
  voteCount: number
  viewCount: number
  createdAt: Date
  user: {
    name: string | null
    username: string | null
    displayUsername: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
  } | null
}

export function BrowseItemBuilds({ builds }: { builds: BrowseItemBuild[] }) {
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
          createdAt={build.createdAt}
          layout={layout}
          subtitle={
            layout === "list"
              ? build.organization ? (
                  <p className="line-clamp-1 text-sm">
                    <OrgBadge
                      name={build.organization.name}
                      slug={build.organization.slug}
                      linked={false}
                    />
                  </p>
                ) : (
                  <p className="text-muted-foreground line-clamp-1 text-sm">
                    by {build.user.displayUsername || build.user.username || build.user.name || "Anonymous"}
                  </p>
                )
              : undefined
          }
        />
      ))}
    </BuildList>
  )
}
