import { Lock, Globe, Link as LinkIcon, Plus, Hammer } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { BuildCardLink } from "@/components/build/build-card-link"
import { BuildsResults } from "@/components/builds/builds-results"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getServerSession } from "@/lib/auth"
import { getUserBuilds } from "@/lib/db/index"

export const metadata: Metadata = {
  title: "My Builds | ARSENYX",
  description: "Manage your saved Warframe builds",
}

interface MyBuildsPageProps {
  searchParams: Promise<{
    page?: string
    sort?: string
  }>
}

export default async function MyBuildsPage({
  searchParams,
}: MyBuildsPageProps) {
  const [session, params] = await Promise.all([
    getServerSession(),
    searchParams,
  ])

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/builds/mine")
  }

  const page = parseInt(params.page || "1", 10)
  const sortBy =
    (params.sort as "newest" | "votes" | "updated" | "views") || "newest"

  const { builds, total } = await getUserBuilds(
    session.user.id,
    session.user.id, // Viewing own builds - shows all including PRIVATE
    { page, limit: 24, sortBy },
  )

  const totalPages = Math.ceil(total / 24)

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "PRIVATE":
        return <Lock className="h-3 w-3" />
      case "UNLISTED":
        return <LinkIcon className="h-3 w-3" />
      default:
        return <Globe className="h-3 w-3" />
    }
  }

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case "PRIVATE":
        return "Private"
      case "UNLISTED":
        return "Unlisted"
      default:
        return "Public"
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Builds</h1>
              <p className="text-muted-foreground">
                {total} build{total !== 1 ? "s" : ""}
              </p>
            </div>
            <Button render={<Link href="/browse" />} nativeButton={false}>
              <Plus data-icon="inline-start" />
              New Build
            </Button>
          </div>

          {/* Sort options */}
          <div className="flex gap-2">
            {(
              [
                { value: "newest", label: "Newest" },
                { value: "updated", label: "Updated" },
                { value: "votes", label: "Most Voted" },
                { value: "views", label: "Most Viewed" },
              ] as const
            ).map((option) => (
              <Link
                key={option.value}
                href={`/builds/mine?sort=${option.value}&page=1`}
              >
                <Button
                  variant={sortBy === option.value ? "secondary" : "ghost"}
                  size="sm"
                >
                  {option.label}
                </Button>
              </Link>
            ))}
          </div>

          {builds.length === 0 ? (
            <div className="py-16 text-center">
              <Hammer className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground mb-4">
                You haven&apos;t created any builds yet.
              </p>
              <Button render={<Link href="/browse" />} nativeButton={false}>
                Create your first build
              </Button>
            </div>
          ) : (
            <>
              <BuildsResults
                renderCard={(layout) =>
                  builds.map((build) => (
                    <BuildCardLink
                      key={build.id}
                      slug={build.slug}
                      name={build.name}
                      itemName={build.item.name}
                      itemImageName={build.item.imageName}
                      voteCount={build.voteCount}
                      viewCount={build.viewCount}
                      layout={layout}
                      imageOverlay={
                        <div className="absolute top-2 right-2">
                          <Badge
                            variant="secondary"
                            className="gap-1 px-1.5 py-0.5 text-xs"
                          >
                            {getVisibilityIcon(build.visibility)}
                            <span className="hidden sm:inline">
                              {getVisibilityLabel(build.visibility)}
                            </span>
                          </Badge>
                        </div>
                      }
                    />
                  ))
                }
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link href={`/builds/mine?page=${page - 1}&sort=${sortBy}`}>
                      <Button variant="outline" size="sm">
                        Previous
                      </Button>
                    </Link>
                  )}
                  <span className="text-muted-foreground text-sm">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link href={`/builds/mine?page=${page + 1}&sort=${sortBy}`}>
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
