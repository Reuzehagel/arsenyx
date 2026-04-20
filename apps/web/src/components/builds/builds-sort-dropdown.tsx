import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BuildListSort } from "@/lib/builds-list-query"

const SORT_ITEMS = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently Updated" },
  { value: "top", label: "Most Liked" },
  { value: "bookmarked", label: "Most Bookmarked" },
  { value: "viewed", label: "Most Viewed" },
] as const

export const SORT_VALUES: BuildListSort[] = SORT_ITEMS.map((i) => i.value)

export function BuildsSortDropdown({
  value,
  onChange,
}: {
  value: BuildListSort
  onChange: (value: BuildListSort) => void
}) {
  return (
    <Select
      items={SORT_ITEMS}
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as BuildListSort)
      }}
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {SORT_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
