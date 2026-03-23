"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { getProfileBuildsAction } from "@/app/actions/profile"
import { BuildCardLink } from "@/components/build/build-card-link"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { BuildListItem } from "@/lib/db/index"

import { ProfileBuildsFilters } from "./profile-builds-filters"

interface ProfileBuildsProps {
  userId: string
  initialBuilds: BuildListItem[]
  initialHasMore: boolean
}

export function ProfileBuilds({
  userId,
  initialBuilds,
  initialHasMore,
}: ProfileBuildsProps) {
  const [builds, setBuilds] = useState(initialBuilds)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [isPending, startTransition] = useTransition()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const hasInteracted = useRef(false)

  const fetchBuilds = useCallback(
    (
      newSearch: string,
      newCategory: string,
      newPage: number,
      append: boolean,
    ) => {
      if (append) {
        setIsLoadingMore(true)
      }
      startTransition(async () => {
        const result = await getProfileBuildsAction(userId, {
          query: newSearch || undefined,
          category: newCategory !== "all" ? newCategory : undefined,
          page: newPage,
        })

        if (result.success) {
          if (append) {
            setBuilds((prev) => [...prev, ...result.data.builds])
          } else {
            setBuilds(result.data.builds)
          }
          setHasMore(result.data.hasMore)
          setPage(newPage)
        }
        setIsLoadingMore(false)
      })
    },
    [userId],
  )

  // Debounced search — skip initial mount
  useEffect(() => {
    if (!hasInteracted.current) {
      hasInteracted.current = true
      return
    }
    const timer = setTimeout(() => {
      fetchBuilds(search, category, 1, false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, category, fetchBuilds])

  function handleLoadMore() {
    fetchBuilds(search, category, page + 1, true)
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileBuildsFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
      />

      {isPending && !isLoadingMore ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      ) : builds.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No builds found</EmptyTitle>
            <EmptyDescription>
              {search || category !== "all"
                ? "Try adjusting your search or filters"
                : "This user hasn't created any builds yet"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {builds.map((build) => (
              <BuildCardLink
                key={build.id}
                slug={build.slug}
                name={build.name}
                itemName={build.item.name}
                itemImageName={build.item.imageName}
                voteCount={build.voteCount}
                viewCount={build.viewCount}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore && <Spinner />}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
