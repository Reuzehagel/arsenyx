"use client"

import { useMemo } from "react"
import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"

interface ProfileBuildsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
}

const CATEGORY_ITEMS = [
  { value: "all", label: "All Categories" },
  ...BROWSE_CATEGORIES.map((cat) => ({ value: cat.id, label: cat.labelPlural })),
]

export function ProfileBuildsFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: ProfileBuildsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search builds..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select
        value={category}
        onValueChange={onCategoryChange}
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
  )
}
