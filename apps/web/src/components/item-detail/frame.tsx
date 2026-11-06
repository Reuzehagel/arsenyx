import { getCategoryLabel } from "@arsenyx/shared/warframe/categories"
import type { BrowseCategory } from "@arsenyx/shared/warframe/types"
import { Link as RouterLink } from "@tanstack/react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"

export function ItemDetailBreadcrumb({
  category,
  itemName,
}: {
  category: BrowseCategory
  /** Absent while the item-detail data is still loading; renders a small
   *  skeleton in the breadcrumb's name slot. */
  itemName?: string
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <RouterLink to="/browse" search={{ category: "warframes" }} />
            }
          >
            Browse
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<RouterLink to="/browse" search={{ category }} />}
          >
            {getCategoryLabel(category)}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {itemName ? (
            <BreadcrumbPage>{itemName}</BreadcrumbPage>
          ) : (
            <Skeleton className="h-4 w-24" />
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
