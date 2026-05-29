import { useQuery } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"

import {
  partnerBuildsQuery,
  type PartnerBuild,
} from "@/lib/queries/partner-builds-query"
import { useItemImage } from "@/lib/use-item-image"
import { getImageUrl } from "@/lib/warframe"

/**
 * Horizontal strip of related builds (currently: other builds for the
 * same item). Renders nothing while loading or when there are no
 * partners. Lazy — only fetched when this strip mounts.
 */
export function RelatedBuildsStrip({ slug }: { slug: string }) {
  const { data: partners } = useQuery(partnerBuildsQuery(slug))
  if (!partners || partners.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Related builds
      </h2>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {partners.map((p) => (
          <li key={p.id} className="shrink-0">
            <RelatedBuildChip build={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RelatedBuildChip({ build }: { build: PartnerBuild }) {
  const itemImage = useItemImage()
  return (
    <RouterLink
      to="/builds/$slug"
      params={{ slug: build.slug }}
      title={build.name}
      className="bg-card hover:bg-card/70 flex w-80 items-center gap-3 rounded-md border py-2 pr-4 pl-2 transition-colors"
    >
      <span className="bg-muted/40 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded">
        <img
          src={getImageUrl(
            itemImage(build.item.uniqueName, build.item.imageName),
          )}
          alt=""
          className="size-full object-contain"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium">{build.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {build.item.name}
        </span>
      </span>
    </RouterLink>
  )
}
