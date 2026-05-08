import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  Link as RouterLink,
} from "@tanstack/react-router"

import { DelayedSuspense } from "@/components/delayed-fallback"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { ItemDetailContent } from "@/components/item-detail/content"
import {
  ItemDetailBreadcrumb,
  ItemDetailFrame,
} from "@/components/item-detail/frame"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { itemQuery } from "@/lib/item-query"
import { isValidCategory, type BrowseCategory } from "@/lib/warframe"

export const Route = createFileRoute("/browse_/$category/$slug")({
  beforeLoad: ({ params }) => {
    if (!isValidCategory(params.category)) throw notFound()
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      itemQuery(params.category as BrowseCategory, params.slug),
    ),
  component: ItemDetailPage,
  notFoundComponent: ItemNotFound,
})

function ItemDetailPage() {
  const { category, slug } = Route.useParams()
  const cat = category as BrowseCategory
  return (
    <ItemDetailFrame>
      <DelayedSuspense
        fallback={
          <>
            <ItemDetailBreadcrumb category={cat} />
            <ItemDetailSkeleton />
          </>
        }
      >
        <ItemDetailView category={cat} slug={slug} />
      </DelayedSuspense>
    </ItemDetailFrame>
  )
}

function ItemDetailView({
  category,
  slug,
}: {
  category: BrowseCategory
  slug: string
}) {
  const { data: item } = useSuspenseQuery(itemQuery(category, slug))
  return (
    <>
      <ItemDetailBreadcrumb category={category} itemName={item.name} />
      <ItemDetailContent item={item} category={category} slug={slug} />
    </>
  )
}

function ItemDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-8"
    >
      <span className="sr-only">Loading item…</span>
      <div className="border-border/50 relative isolate overflow-hidden rounded-2xl border">
        <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:gap-8 md:p-12">
          <Skeleton className="size-40 shrink-0 self-center rounded-xl md:size-56 md:self-auto" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-2/3 md:h-16" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-4/5 max-w-2xl" />
            <div className="flex flex-wrap gap-2 pt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-full" />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-32 rounded-full" />
              ))}
            </div>
            <div className="flex items-center gap-4 pt-2">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-56" />
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(190px,1fr))] [&>*]:max-w-[240px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

function ItemNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col items-center gap-4 py-20 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Item not found</h1>
          <p className="text-muted-foreground">
            We couldn't find an item at that path.
          </p>
          <Button
            render={
              <RouterLink to="/browse" search={{ category: "warframes" }} />
            }
          >
            Back to Browse
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
