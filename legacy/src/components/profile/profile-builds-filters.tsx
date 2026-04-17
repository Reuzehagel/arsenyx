"use client"

import { SearchIcon } from "lucide-react"

import { ViewToggle } from "@/components/build/view-preference"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BUILD_SORT_OPTIONS, type BuildSortBy } from "@/lib/builds/sort"
import { cn } from "@/lib/utils"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"

interface ProfileBuildsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  sortBy: BuildSortBy
  onSortChange: (value: BuildSortBy) => void
}

const CATEGORY_ITEMS = [
  { value: "all", label: "All Categories" },
  ...BROWSE_CATEGORIES.map((cat) => ({
    value: cat.id,
    label: cat.labelPlural,
  })),
]

export function ProfileBuildsFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sortBy,
  onSortChange,
}: ProfileBuildsFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search builds…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(value) => {
            if (value) onCategoryChange(value)
          }}
          items={CATEGORY_ITEMS}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CATEGORY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {BUILD_SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={sortBy === option.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onSortChange(option.value)}
              className={cn(
                sortBy !== option.value && "text-muted-foreground",
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <ViewToggle />
      </div>
    </div>
  )
}
