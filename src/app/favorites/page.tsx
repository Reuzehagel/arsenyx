import { Heart } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { BuildCardLink } from "@/components/build/build-card-link"
import { BuildsResults } from "@/components/builds/builds-results"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { getServerSession } from "@/lib/auth"
import { getUserFavoriteBuilds } from "@/lib/db/index"

export const metadata: Metadata = {
  title: "Favorites | ARSENYX",
  description: "Your favorited Warframe builds",
}

interface FavoritesPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function FavoritesPage({
  searchParams,
}: FavoritesPageProps) {
  const [session, params] = await Promise.all([
    getServerSession(),
    searchParams,
  ])

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/favorites")
  }

  const page = parseInt(params.page || "1", 10)

  const { builds, total } = await getUserFavoriteBuilds(session.user.id, {
    page,
    limit: 24,
  })

  const totalPages = Math.ceil(total / 24)

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          <div>
            <h1 className="text-2xl font-bold">Favorites</h1>
            <p className="text-muted-foreground">
              {total} saved build{total !== 1 ? "s" : ""}
            </p>
          </div>

          {builds.length === 0 ? (
            <div className="py-16 text-center">
              <Heart className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground mb-4">
                You haven&apos;t favorited any builds yet.
              </p>
              <Button render={<Link href="/builds" />} nativeButton={false}>
                Browse community builds
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
                      subtitle={
                        layout === "list" ? (
                          <p className="text-muted-foreground line-clamp-1 text-sm">
                            {build.item.name} by{" "}
                            {build.user.displayUsername || build.user.username || build.user.name || "Anonymous"}
                          </p>
                        ) : undefined
                      }
                    />
                  ))
                }
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link href={`/favorites?page=${page - 1}`}>
                      <Button variant="outline" size="sm">
                        Previous
                      </Button>
                    </Link>
                  )}
                  <span className="text-muted-foreground text-sm">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link href={`/favorites?page=${page + 1}`}>
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
