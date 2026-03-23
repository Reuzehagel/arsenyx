"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"
import type { BrowseCategory } from "@/lib/warframe/types"

interface CategoryTabsProps {
  activeCategory: BrowseCategory
  counts?: Record<BrowseCategory, number>
  className?: string
}

export function CategoryTabs({
  activeCategory,
  counts,
  className,
}: CategoryTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const handleCategoryChange = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParamsString)
      params.set("category", category)
      // Reset query when changing category
      params.delete("q")
      const next = params.toString()
      if (next === searchParamsString) return
      router.push(`?${next}`, { scroll: false })
    },
    [router, searchParamsString],
  )

  return (
    <Tabs
      value={activeCategory}
      onValueChange={handleCategoryChange}
      className={className}
    >
      <TabsList className="bg-muted/50 h-auto flex-wrap justify-start p-1">
        {BROWSE_CATEGORIES.map((category, index) => (
          <TabsTrigger
            key={category.id}
            value={category.id}
            className={cn(
              "data-[state=active]:bg-background gap-2",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1",
            )}
            // Keyboard shortcut hint
            title={`Press ${index + 1} to switch`}
          >
            <span>{category.label}</span>
            {counts && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {counts[category.id]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
