"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"
import type { BrowseCategory } from "@/lib/warframe/types"

interface CategoryTabsProps {
  activeCategory: BrowseCategory | ""
  counts?: Record<BrowseCategory, number>
  className?: string
  /** Show "All Categories" as the first tab */
  showAll?: boolean
  /** Use Link-based navigation instead of client-side router.push */
  linkNavigation?: boolean
}

export function CategoryTabs({
  activeCategory,
  counts,
  className,
  showAll = false,
  linkNavigation = false,
}: CategoryTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const buildCategoryHref = useCallback(
    (categoryValue: string | undefined) => {
      const params = new URLSearchParams(searchParamsString)
      if (categoryValue) {
        params.set("category", categoryValue)
      } else {
        params.delete("category")
      }
      // Reset query and page when changing category
      params.delete("q")
      params.delete("page")
      const str = params.toString()
      return `${pathname}${str ? `?${str}` : ""}`
    },
    [pathname, searchParamsString],
  )

  const handleCategoryChange = useCallback(
    (category: string) => {
      if (linkNavigation) return
      const params = new URLSearchParams(searchParamsString)
      params.set("category", category)
      params.delete("q")
      const next = params.toString()
      if (next === searchParamsString) return
      router.push(`?${next}`, { scroll: false })
    },
    [router, searchParamsString, linkNavigation],
  )

  const tabs = showAll
    ? [{ id: "" as const, label: "All Categories" }, ...BROWSE_CATEGORIES]
    : BROWSE_CATEGORIES

  return (
    <Tabs
      value={activeCategory}
      onValueChange={linkNavigation ? undefined : handleCategoryChange}
      className={className}
    >
      <TabsList className="bg-muted/50 h-auto flex-wrap justify-start p-1">
        {tabs.map((category, index) => {
          const value = category.id
          return (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "data-[state=active]:bg-background gap-2",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1",
              )}
              title={!showAll ? `Press ${index + 1} to switch` : undefined}
              render={
                linkNavigation ? (
                  <Link href={buildCategoryHref(value || undefined)} />
                ) : undefined
              }
              nativeButton={linkNavigation ? false : undefined}
            >
              <span>{category.label}</span>
              {counts && value && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {counts[value as BrowseCategory]}
                </span>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
