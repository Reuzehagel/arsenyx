import { Link as RouterLink } from "@tanstack/react-router"
import { Pencil } from "lucide-react"

import { EndoFormaBadges } from "@/components/endo-forma-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { BuildDetail } from "@/lib/queries/build-query"
import { formatAbsoluteTime, relativeTime } from "@/lib/util/relative-time"
import { formatVisibility } from "@/lib/util/user-display"
import { getImageUrl, type BrowseCategory } from "@/lib/warframe"

import { BuildActionsMenu } from "./build-actions-menu"
import { SocialActions } from "./social-actions"

/**
 * Read-only header for `/builds/$slug`. Owner sees an Edit button that
 * jumps to `/create?build=<slug>`; everyone gets fork/delete via the
 * actions menu and like/bookmark via social actions.
 */
export function ViewerHeader({
  build,
  categoryLabel,
  author,
  totalEndoCost,
  formaCount,
  category,
  itemSlug,
  itemImageName,
}: {
  build: BuildDetail
  categoryLabel: string
  author: string
  totalEndoCost: number
  formaCount: number
  category: BrowseCategory
  itemSlug: string
  /** Fresh image from the live catalog (resolved by uniqueName upstream).
   *  Preferred over the build's stored `item.imageName`, which rots across
   *  image-scheme changes. */
  itemImageName?: string
}) {
  const headerImage = itemImageName ?? build.item.imageName ?? undefined
  return (
    <div className="bg-card mb-4 rounded-lg border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="bg-muted/10 relative flex size-[clamp(4rem,8vw,6rem)] shrink-0 items-center justify-center overflow-hidden rounded-md">
            {headerImage ? (
              <img
                src={getImageUrl(headerImage)}
                alt={build.item.name}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <h1 className="truncate text-[clamp(1.25rem,2vw,1.5rem)] leading-tight font-bold tracking-tight">
              {build.name}
            </h1>
            <span className="text-muted-foreground text-sm">
              <RouterLink
                to="/browse/$category/$slug"
                params={{ category, slug: itemSlug }}
                className="hover:text-foreground hover:underline"
              >
                {build.item.name}
              </RouterLink>
              {" · "}
              <RouterLink
                to="/browse"
                search={{ category }}
                className="hover:text-foreground hover:underline"
              >
                {categoryLabel}
              </RouterLink>
              {" · "}
              {build.organization ? (
                <>
                  <RouterLink
                    to="/org/$slug"
                    params={{ slug: build.organization.slug }}
                    className="text-[#a78bfa] hover:underline"
                  >
                    {build.organization.name}
                  </RouterLink>
                  {!build.hideAuthor && " · "}
                </>
              ) : null}
              {(!build.organization || !build.hideAuthor) &&
                (build.user.username ? (
                  <>
                    by{" "}
                    <RouterLink
                      to="/profile/$username"
                      params={{ username: build.user.username }}
                      className="hover:text-foreground hover:underline"
                    >
                      {author}
                    </RouterLink>
                  </>
                ) : (
                  <>by {author}</>
                ))}
            </span>
            {/* Endo/forma stay as subtle stat pills (the build's headline
                numbers); likes/views and the updated time recede to quiet muted
                text rather than competing as bordered badges — the header read
                as four stacked pills before. */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <EndoFormaBadges
                totalEndoCost={totalEndoCost}
                formaCount={formaCount}
              />
              {/* Like count lives on the ♥ button below — don't repeat it
                  here. Views aren't shown anywhere else, so they stay. */}
              <span>{build.viewCount.toLocaleString("en-US")} views</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="cursor-default">
                      Updated {relativeTime(build.updatedAt)}
                    </span>
                  }
                />
                <TooltipContent>
                  Updated {formatAbsoluteTime(build.updatedAt)}
                </TooltipContent>
              </Tooltip>
              {build.visibility !== "PUBLIC" ? (
                <Badge variant="secondary" className="text-xs">
                  {formatVisibility(build.visibility)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ButtonGroup>
            <SocialActions build={build} />
          </ButtonGroup>
          {build.isOwner ? (
            <Button
              size="sm"
              nativeButton={false}
              className="cursor-default"
              render={
                <RouterLink
                  to="/create"
                  search={{ category, item: itemSlug, build: build.slug }}
                />
              }
            >
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          ) : null}
          <BuildActionsMenu
            slug={build.slug}
            name={build.name}
            isOwner={build.isOwner}
            visibility={build.visibility}
          />
        </div>
      </div>
    </div>
  )
}
