import { getItemUrl } from "@arsenyx/shared/seo/site"
import type { BrowseItem } from "@arsenyx/shared/warframe/types"

import { Link } from "@/components/link"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getImageUrl } from "@/lib/image-url"
import { cn } from "@/lib/util/utils"

interface ItemCardProps {
  item: BrowseItem
}

export function ItemCard({ item }: ItemCardProps) {
  return (
    <Link
      href={getItemUrl(item.category, item.slug)}
      className="group focus-visible:ring-ring rounded-xl outline-none [contain-intrinsic-size:auto_280px] [content-visibility:auto] focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Card className="hover:border-primary/50 group-focus-visible:border-primary/50 relative h-full gap-0 overflow-hidden py-0 transition-[box-shadow,border-color] duration-200 hover:shadow-md">
        {item.vaulted && (
          <Badge
            variant="outline"
            className="bg-background/80 absolute top-2 right-2 z-10 px-2 py-0.5 text-xs"
          >
            Vaulted
          </Badge>
        )}

        <div className="bg-muted/30 relative flex aspect-square items-center justify-center overflow-hidden">
          <img
            src={getImageUrl(item.imageName)}
            alt={item.name}
            loading="lazy"
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-110",
              // Operator renders are full-body portraits; anchor to the head, not the torso
              item.category === "operators" && "object-top",
              !item.imageName && "opacity-50",
            )}
          />
        </div>

        <div className="flex flex-col gap-1 p-3">
          <h3 className="group-hover:text-primary line-clamp-2 text-sm leading-tight font-medium transition-colors">
            {item.name}
          </h3>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            {item.displayClass && (
              <span className="max-w-[60%] truncate">{item.displayClass}</span>
            )}
            {item.masteryReq !== undefined && item.masteryReq > 0 && (
              <span className="shrink-0">MR {item.masteryReq}</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function ItemCardSkeleton() {
  return (
    <Card className="relative h-full gap-0 overflow-hidden py-0">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-1 p-3">
        <Skeleton className="h-[1rem] w-3/4" />
        <div className="flex items-center justify-between pt-0.5">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </Card>
  )
}
