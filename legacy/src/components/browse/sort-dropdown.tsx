"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SortOption } from "@/lib/warframe/types"

interface SortDropdownProps {
  sortOption: SortOption
  onSortChange: (value: SortOption) => void
}

const sortItems = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "date-desc", label: "Newest First" },
  { value: "date-asc", label: "Oldest First" },
] as const

export function SortDropdown({ sortOption, onSortChange }: SortDropdownProps) {
  return (
    <div className="shrink-0">
      <Select
        items={sortItems}
        value={sortOption}
        onValueChange={(value) => {
          if (value) onSortChange(value as SortOption)
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {sortItems.map((item) => (
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
