import { SortSelect } from "@/components/sort-select"
import type { SortOption } from "@/lib/items-index"

const SORT_LABELS: Record<SortOption, string> = {
  "name-asc": "Name A-Z",
  "name-desc": "Name Z-A",
  "date-desc": "Newest First",
  "date-asc": "Oldest First",
}

const SORT_ITEMS = (Object.keys(SORT_LABELS) as SortOption[]).map((value) => ({
  value,
  label: SORT_LABELS[value],
}))

interface SortDropdownProps {
  value: SortOption
  onChange: (value: SortOption) => void
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <SortSelect
      items={SORT_ITEMS}
      value={value}
      onChange={onChange}
      triggerWidth="w-36"
    />
  )
}
