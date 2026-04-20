import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
    <Select
      items={SORT_ITEMS}
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as SortOption)
      }}
    >
      <SelectTrigger className="w-36">
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
