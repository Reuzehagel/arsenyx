import { Skeleton } from "@/components/ui/skeleton"
import type { BrowseItem } from "@/lib/warframe/types"

import { ItemCard } from "./item-card"

interface ItemGridProps {
  items: BrowseItem[]
  isLoading?: boolean
}

export function ItemGrid({ items, isLoading }: ItemGridProps) {
  if (isLoading) {
    return <ItemGridSkeleton />
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No items found</p>
        <p className="text-muted-foreground/70 text-sm">
          Try adjusting your search or filters
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item, index) => (
        <div
          key={item.uniqueName}
          style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
        >
          <ItemCard item={item} index={index} />
        </div>
      ))}
    </div>
  )
}

function ItemGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
