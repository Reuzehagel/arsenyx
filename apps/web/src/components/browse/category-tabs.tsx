import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CATEGORIES, type BrowseCategory } from "@/lib/warframe"

interface CategoryTabsProps {
  activeCategory: BrowseCategory
  onChange: (category: BrowseCategory) => void
}

export function CategoryTabs({ activeCategory, onChange }: CategoryTabsProps) {
  return (
    <Tabs
      value={activeCategory}
      onValueChange={(v) => onChange(v as BrowseCategory)}
    >
      <TabsList>
        {CATEGORIES.map((c) => (
          <TabsTrigger key={c.id} value={c.id}>
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
