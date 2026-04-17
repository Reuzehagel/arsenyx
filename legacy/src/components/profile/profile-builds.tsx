"use client"

import { useCallback, useRef, useState, useTransition } from "react"

import {
  getOrgBuildsAction,
  getProfileBuildsAction,
} from "@/app/actions/profile"
import { BuildCardLink } from "@/components/build/build-card-link"
import { BuildList, useBuildLayout } from "@/components/build/build-list"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { BuildListItem } from "@/lib/db/index"

import type { BuildSortBy } from "@/lib/builds/sort"

import { ProfileBuildsFilters } from "./profile-builds-filters"

interface ProfileBuildsProps {
  userId?: string
  orgId?: string
  initialBuilds: BuildListItem[]
  initialHasMore: boolean
  emptyMessage?: string
}

export function ProfileBuilds({
  userId,
  orgId,
  initialBuilds,
  initialHasMore,
  emptyMessage = "This user hasn't created any builds yet",
}: ProfileBuildsProps) {
  const layout = useBuildLayout()
  const [builds, setBuilds] = useState(initialBuilds)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [sortBy, setSortBy] = useState<BuildSortBy>("votes")
  const [, startTransition] = useTransition()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchBuilds = useCallback(
    (
      newSearch: string,
      newCategory: string,
      newSortBy: string,
      newPage: number,
      append: boolean,
    ) => {
      if (append) {
        setIsLoadingMore(true)
      }
      startTransition(async () => {
        const fetchOptions = {
          query: newSearch || undefined,
          category: newCategory !== "all" ? newCategory : undefined,
          sortBy: newSortBy,
          page: newPage,
        }
        const result = orgId
          ? await getOrgBuildsAction(orgId, fetchOptions)
          : await getProfileBuildsAction(userId!, fetchOptions)

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
    [userId, orgId],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        fetchBuilds(value, category, sortBy, 1, false)
      }, 300)
    },
    [fetchBuilds, category, sortBy],
  )

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategory(value)
      fetchBuilds(search, value, sortBy, 1, false)
    },
    [fetchBuilds, search, sortBy],
  )

  const handleSortChange = useCallback(
    (value: BuildSortBy) => {
      setSortBy(value)
      fetchBuilds(search, category, value, 1, false)
    },
    [fetchBuilds, search, category],
  )

  function handleLoadMore() {
    fetchBuilds(search, category, sortBy, page + 1, true)
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileBuildsFilters
        search={search}
        onSearchChange={handleSearchChange}
        category={category}
        onCategoryChange={handleCategoryChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
      />

      {builds.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No builds found</EmptyTitle>
            <EmptyDescription>
              {search || category !== "all"
                ? "Try adjusting your search or filters"
                : emptyMessage}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <BuildList showToolbar={false}>
            {builds.map((build) => (
              <BuildCardLink
                key={build.id}
                slug={build.slug}
                name={build.name}
                itemName={build.item.name}
                itemImageName={build.item.imageName}
                voteCount={build.voteCount}
                viewCount={build.viewCount}
                createdAt={build.createdAt}
                layout={layout}
              />
            ))}
          </BuildList>
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
