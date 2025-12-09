"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories";
import type { BrowseCategory } from "@/lib/warframe/types";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  activeCategory: BrowseCategory;
  counts?: Record<BrowseCategory, number>;
  className?: string;
}

export function CategoryTabs({
  activeCategory,
  counts,
  className,
}: CategoryTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const handleCategoryChange = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParamsString);
      params.set("category", category);
      // Reset query when changing category
      params.delete("q");
      const next = params.toString();
      if (next === searchParamsString) return;
      router.push(`?${next}`, { scroll: false });
    },
    [router, searchParamsString]
  );

  return (
    <Tabs
      value={activeCategory}
      onValueChange={handleCategoryChange}
      className={className}
    >
      <TabsList className="h-auto p-1 flex-wrap justify-start bg-muted/50">
        {BROWSE_CATEGORIES.map((category, index) => (
          <TabsTrigger
            key={category.id}
            value={category.id}
            className={cn(
              "data-[state=active]:bg-background gap-2",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            )}
            // Keyboard shortcut hint
            title={`Press ${index + 1} to switch`}
          >
            <span>{category.label}</span>
            {counts && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {counts[category.id]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
