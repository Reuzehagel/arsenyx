import { Link as RouterLink } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import { getCategoryLabel, type BrowseCategory } from "@/lib/warframe"

/** Page chrome (Header + main wrap + Footer). Stays mounted across the
 *  Suspense boundary so the header doesn't unmount/remount when item data
 *  resolves. */
export function ItemDetailFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-6 py-6">{children}</div>
      </main>
      <Footer />
    </div>
  )
}

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
