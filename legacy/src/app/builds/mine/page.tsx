import { Plus, Hammer } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { ViewToggle } from "@/components/build/view-preference"
import { MyBuildsList } from "@/components/builds/my-builds-list"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { getServerSession } from "@/lib/auth"
import { BUILD_SORT_OPTIONS, type BuildSortBy } from "@/lib/builds/sort"
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
  const sortBy = (params.sort as BuildSortBy) || "newest"

  const { builds, total } = await getUserBuilds(
    session.user.id,
    session.user.id, // Viewing own builds - shows all including PRIVATE
    { page, limit: 24, sortBy },
  )

  const totalPages = Math.ceil(total / 24)

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

          {/* Sort options + view toggle */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {BUILD_SORT_OPTIONS.map((option) => (
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
            <ViewToggle />
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
              <MyBuildsList builds={builds} />

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
