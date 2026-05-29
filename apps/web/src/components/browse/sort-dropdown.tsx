import { SortSelect } from "@/components/sort-select"

const SORT_ITEMS = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "date-desc", label: "Newest First" },
  { value: "date-asc", label: "Oldest First" },
] as const

export type SortOption = (typeof SORT_ITEMS)[number]["value"]

export const SORT_VALUES: SortOption[] = SORT_ITEMS.map((i) => i.value)

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
