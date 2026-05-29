import { CategoryTabs as SharedCategoryTabs } from "@/components/category-tabs"
import { type BrowseCategory } from "@/lib/warframe"

type BrowseFilter = BrowseCategory | "all"

interface CategoryTabsProps {
  activeCategory: BrowseFilter
  onChange: (category: BrowseFilter) => void
}

export function CategoryTabs({ activeCategory, onChange }: CategoryTabsProps) {
  return (
    <SharedCategoryTabs
      value={activeCategory}
      onChange={(v) => onChange(v as BrowseFilter)}
    />
  )
}
