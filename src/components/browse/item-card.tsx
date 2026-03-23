import Image from "next/image"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getImageUrl, getItemUrl } from "@/lib/warframe"
import type { BrowseItem } from "@/lib/warframe/types"

interface ItemCardProps {
  item: BrowseItem
  index?: number
}

export function ItemCard({ item, index }: ItemCardProps) {
  const imageUrl = getImageUrl(item.imageName)
  const itemUrl = getItemUrl(item.category, item.slug)

  return (
    <Link
      href={itemUrl}
      data-index={index}
      className="group focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Card className="hover:border-primary/50 group-focus-visible:border-primary/50 relative h-full gap-0 overflow-hidden py-0 transition-all duration-200 hover:shadow-md">
        {/* Vaulted badge */}
        {item.vaulted && (
          <Badge
            variant="outline"
            className="bg-background/80 absolute top-2 right-2 z-10 px-2 py-0.5 text-xs"
          >
            Vaulted
          </Badge>
        )}

        {/* Image container */}
        <div className="bg-muted/30 relative flex aspect-square items-center justify-center overflow-hidden">
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 50vw, 200px"
            className={cn(
              "object-cover transition-transform duration-200 group-hover:scale-110",
              !item.imageName && "opacity-50",
            )}
            unoptimized
          />
        </div>

        {/* Info section */}
        <div className="flex flex-col gap-1 p-3">
          <h3 className="group-hover:text-primary line-clamp-2 text-sm leading-tight font-medium transition-colors">
            {item.name}
          </h3>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            {item.type && (
              <span className="max-w-[60%] truncate">{item.type}</span>
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
