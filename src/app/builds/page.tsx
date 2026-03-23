import { XIcon } from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { BuildStats } from "@/components/build/build-card-link"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPublicBuilds, type BuildListItem } from "@/lib/db/index"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"
import { getImageUrl } from "@/lib/warframe/images"

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

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  ...BROWSE_CATEGORIES.map((c) => ({ value: c.id, label: c.labelPlural })),
]

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "votes", label: "Most Voted" },
  { value: "views", label: "Most Viewed" },
  { value: "updated", label: "Recently Updated" },
]

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
  const hasActiveFilters = !!(q || author || hasGuide || hasShards)

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Community Builds</h1>
              <p className="text-muted-foreground">
                Discover builds created by the community
              </p>
            </div>
            <Link href="/browse">
              <Button variant="outline">Create Build</Button>
            </Link>
          </div>

          {/* Search Bar */}
          <form action="/builds" method="GET" className="flex gap-2">
            <div className="relative flex-1">
              <Icons.search className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search builds..."
                className="pl-10"
              />
            </div>
            {category && (
              <input type="hidden" name="category" value={category} />
            )}
            {sortBy !== "newest" && (
              <input type="hidden" name="sort" value={sortBy} />
            )}
            {author && <input type="hidden" name="author" value={author} />}
            {hasGuide && <input type="hidden" name="hasGuide" value="true" />}
            {hasShards && <input type="hidden" name="hasShards" value="true" />}
            <Button type="submit">Search</Button>
          </form>

          {/* Filters */}
          <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
            {/* Category Filter */}
            <Tabs value={category || ""} className="w-full xl:w-auto">
              <TabsList className="bg-muted/50 h-auto w-full flex-wrap justify-start p-1 xl:w-auto">
                {CATEGORY_OPTIONS.map((opt) => (
                  <TabsTrigger
                    key={opt.value}
                    value={opt.value}
                    className="data-[state=active]:bg-background flex-1 gap-2 xl:flex-none"
                    render={
                      <Link
                        href={buildFilterUrl(
                          { category: opt.value || undefined },
                          filterState,
                        )}
                      />
                    }
                    nativeButton={false}
                  >
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Sort Options */}
            <div className="flex w-full items-center justify-end xl:w-auto">
              <Tabs value={sortBy} className="w-full xl:w-auto">
                <TabsList className="bg-muted/50 w-full xl:w-auto">
                  {SORT_OPTIONS.map((opt) => (
                    <TabsTrigger
                      key={opt.value}
                      value={opt.value}
                      className="flex-1 xl:flex-none"
                      render={
                        <Link
                          href={buildFilterUrl(
                            { sort: opt.value },
                            filterState,
                          )}
                        />
                      }
                      nativeButton={false}
                    >
                      {opt.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Active Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {author && (
              <Link href={buildFilterUrl({ author: undefined }, filterState)}>
                <Badge variant="secondary" className="cursor-pointer gap-1">
                  Author: {author}
                  <XIcon className="size-3" />
                  <span className="sr-only">Remove author filter</span>
                </Badge>
              </Link>
            )}
            <Link
              href={buildFilterUrl(
                { hasGuide: hasGuide ? undefined : "true" },
                filterState,
              )}
            >
              <Button variant={hasGuide ? "default" : "outline"} size="sm">
                Has Guide
              </Button>
            </Link>
            <Link
              href={buildFilterUrl(
                { hasShards: hasShards ? undefined : "true" },
                filterState,
              )}
            >
              <Button variant={hasShards ? "default" : "outline"} size="sm">
                Has Shards
              </Button>
            </Link>
            {hasActiveFilters && (
              <Link href="/builds">
                <Button variant="ghost" size="sm">
                  Clear All
                </Button>
              </Link>
            )}
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
