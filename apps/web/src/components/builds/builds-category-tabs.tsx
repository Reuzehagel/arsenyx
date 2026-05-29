import { CategoryTabs } from "@/components/category-tabs"
import { type BrowseCategory } from "@/lib/warframe"

const ALL = "all" as const

export function BuildsCategoryTabs({
  value,
  onChange,
}: {
  value: BrowseCategory | undefined
  onChange: (value: BrowseCategory | undefined) => void
}) {
  return (
    <CategoryTabs
      value={value ?? ALL}
      onChange={(v) => {
        if (v === ALL) onChange(undefined)
        else onChange(v as BrowseCategory)
      }}
    />
  )
}
