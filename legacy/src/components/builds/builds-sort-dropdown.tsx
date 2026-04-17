"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const sortItems = [
  { value: "newest", label: "Newest" },
  { value: "votes", label: "Most Voted" },
  { value: "views", label: "Most Viewed" },
  { value: "updated", label: "Recently Updated" },
] as const

type BuildSortOption = (typeof sortItems)[number]["value"]

export function BuildsSortDropdown() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get("sort") as BuildSortOption) || "newest"

  const handleChange = useCallback(
    (value: string | null) => {
      if (!value) return
      const params = new URLSearchParams(searchParams.toString())
      if (value === "newest") {
        params.delete("sort")
      } else {
        params.set("sort", value)
      }
      params.delete("page")
      const next = params.toString()
      router.push(`/builds${next ? `?${next}` : ""}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="shrink-0">
      <Select items={sortItems} value={current} onValueChange={handleChange}>
        <SelectTrigger className="w-[160px]">
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
