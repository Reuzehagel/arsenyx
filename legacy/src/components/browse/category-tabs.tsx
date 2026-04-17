"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"
import type { BrowseCategory } from "@/lib/warframe/types"

interface CategoryTabsProps {
  activeCategory: BrowseCategory | ""
  className?: string
  /** Show "All Categories" as the first tab */
  showAll?: boolean
}

export function CategoryTabs({
  activeCategory,
  className,
  showAll = false,
}: CategoryTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const handleCategoryChange = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParamsString)
      if (category) {
        params.set("category", category)
      } else {
        params.delete("category")
      }
      params.delete("q")
      params.delete("page")
      const next = params.toString()
      router.push(`${pathname}${next ? `?${next}` : ""}`, { scroll: false })
    },
    [router, pathname, searchParamsString],
  )

  const tabs = showAll
    ? [{ id: "" as const, label: "All Categories" }, ...BROWSE_CATEGORIES]
    : BROWSE_CATEGORIES

  return (
    <Tabs
      value={activeCategory}
      onValueChange={handleCategoryChange}
      className={className}
    >
      <TabsList className="bg-muted/50 !h-auto w-full flex-wrap justify-start p-1">
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
            >
              <span>{category.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
