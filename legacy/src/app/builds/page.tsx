import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { CategoryTabs } from "@/components/browse/category-tabs"
import { SearchBar } from "@/components/browse/search-bar"
import { BuildsFilterDropdown, BuildsSortDropdown } from "@/components/builds"
import { CommunityBuildsList } from "@/components/builds/community-builds-list"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getPublicBuilds } from "@/lib/db/index"
import type { BrowseCategory } from "@/lib/warframe/types"

export const metadata: Metadata = {
  title: "Browse Builds | ARSENYX",
  description: "Discover and explore community Warframe builds.",
}

interface BuildsPageProps {
  searchParams: Promise<{
    category?: string
    sort?: "newest" | "popular" | "updated"
    page?: string
    q?: string
    author?: string
    hasGuide?: string
    hasShards?: string
  }>
}

/** Build a URLSearchParams string preserving all active filters */
function buildFilterUrl(
  overrides: Record<string, string | undefined>,
  current: {
    category?: string
    sort: string
    q?: string
    author?: string
    hasGuide?: string
    hasShards?: string
  },
) {
  const merged = { ...current, ...overrides }
  const params = new URLSearchParams()
  if (merged.category) params.set("category", merged.category)
  if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort)
  if (merged.q) params.set("q", merged.q)
  if (merged.author) params.set("author", merged.author)
  if (merged.hasGuide) params.set("hasGuide", merged.hasGuide)
  if (merged.hasShards) params.set("hasShards", merged.hasShards)
  // Never preserve page when changing filters
  if (overrides.page) params.set("page", overrides.page)
  const str = params.toString()
  return `/builds${str ? `?${str}` : ""}`
}

function BuildResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  )
}

async function BuildResults({
  category,
  sortBy,
  page,
  limit,
  q,
  author,
  hasGuide,
  hasShards,
  filterState,
}: {
  category: string | undefined
  sortBy: "newest" | "votes" | "views" | "updated"
  page: number
  limit: number
  q: string | undefined
  author: string | undefined
  hasGuide: boolean | undefined
  hasShards: boolean | undefined
  filterState: {
    category?: string
    sort: string
    q?: string
    author?: string
    hasGuide?: string
    hasShards?: string
  }
}) {
  const { builds, total } = await getPublicBuilds({
    category,
    sortBy,
    page,
    limit,
    query: q,
    author,
    hasGuide,
    hasShards,
  })

  const totalPages = Math.ceil(total / limit)

  if (builds.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No builds found.</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Be the first to{" "}
          <Link href="/browse" className="text-primary underline">
            create a build
          </Link>
          !
        </p>
      </div>
    )
  }

  return (
    <>
      <CommunityBuildsList builds={builds} count={total} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildFilterUrl({ page: String(page - 1) }, filterState)}
            >
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </Link>
          )}
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildFilterUrl({ page: String(page + 1) }, filterState)}
            >
              <Button variant="outline" size="sm">
                Next
              </Button>
            </Link>
          )}
        </div>
      )}
    </>
  )
}

export default async function BuildsPage({ searchParams }: BuildsPageProps) {
  const params = await searchParams
  const category = params.category || undefined
  const sortBy =
    (params.sort as "newest" | "votes" | "views" | "updated") || "newest"
  const page = parseInt(params.page || "1", 10)
  const q = params.q || undefined
  const author = params.author || undefined
  const hasGuide = params.hasGuide === "true" ? true : undefined
  const hasShards = params.hasShards === "true" ? true : undefined
  const limit = 24

  const filterState = {
    category,
    sort: sortBy,
    q,
    author,
    hasGuide: params.hasGuide,
    hasShards: params.hasShards,
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          {/* Page Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Community Builds
            </h1>
            <p className="text-muted-foreground">
              Discover builds created by the community
            </p>
          </div>

          {/* Search and Filters Row */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Suspense>
              <SearchBar
                defaultValue={q}
                placeholder="Search builds…"
                className="flex-1"
              />
            </Suspense>
            <div className="flex gap-3">
              <Suspense>
                <BuildsSortDropdown />
              </Suspense>
              <Suspense>
                <BuildsFilterDropdown />
              </Suspense>
            </div>
          </div>

          {/* Category Tabs */}
          <Suspense>
            <CategoryTabs
              activeCategory={(category as BrowseCategory) || ""}
              showAll
            />
          </Suspense>

          {/* Results */}
          <Suspense fallback={<BuildResultsSkeleton />}>
            <BuildResults
              category={category}
              sortBy={sortBy}
              page={page}
              limit={limit}
              q={q}
              author={author}
              hasGuide={hasGuide}
              hasShards={hasShards}
              filterState={filterState}
            />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
