import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"

import { CategoryTabs } from "@/components/browse/category-tabs"
import { SearchBar } from "@/components/browse/search-bar"
import { BuildStats } from "@/components/build/build-card-link"
import { BuildsFilterDropdown, BuildsSortDropdown } from "@/components/builds"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPublicBuilds, type BuildListItem } from "@/lib/db/index"
import { getImageUrl } from "@/lib/warframe/images"
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

// Simple relative time formatting without date-fns
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
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

function BuildCard({ build }: { build: BuildListItem }) {
  const timeAgo = getRelativeTime(new Date(build.createdAt))

  return (
    <Link
      href={`/builds/${build.slug}`}
      className="bg-card block overflow-hidden rounded-lg border"
    >
      {/* Item Image */}
      <div className="bg-muted/20 relative aspect-video">
        <Image
          src={getImageUrl(build.item.imageName ?? undefined)}
          alt={build.item.name}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute right-2 bottom-2 left-2">
          <Badge variant="secondary" className="text-xs">
            {build.item.browseCategory}
          </Badge>
        </div>
      </div>

      {/* Build Info */}
      <div className="flex flex-col gap-2 p-3">
        <div>
          <h3 className="line-clamp-1 text-sm font-semibold">{build.name}</h3>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {build.item.name}
          </p>
        </div>

        {/* Author and Stats */}
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span className="line-clamp-1">
            by {build.user.username || build.user.name || "Anonymous"}
          </span>
          <BuildStats voteCount={build.voteCount} viewCount={build.viewCount} />
        </div>

        <p className="text-muted-foreground text-xs">{timeAgo}</p>
      </div>
    </Link>
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
              linkNavigation
            />
          </Suspense>

          {/* Results info */}
          <div className="text-muted-foreground text-sm">
            {total} {total === 1 ? "build" : "builds"}
            {q && ` matching "${q}"`}
          </div>

          {/* Results */}
          {builds.length === 0 ? (
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
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {builds.map((build) => (
                  <BuildCard key={build.id} build={build} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link
                      href={buildFilterUrl(
                        { page: String(page - 1) },
                        filterState,
                      )}
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
                      href={buildFilterUrl(
                        { page: String(page + 1) },
                        filterState,
                      )}
                    >
                      <Button variant="outline" size="sm">
                        Next
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
