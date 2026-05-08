import { TabScroller } from "@/components/tab-scroller"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CATEGORIES, type BrowseCategory } from "@/lib/warframe"

type BrowseFilter = BrowseCategory | "all"

interface CategoryTabsProps {
  activeCategory: BrowseFilter
  onChange: (category: BrowseFilter) => void
}

export function CategoryTabs({ activeCategory, onChange }: CategoryTabsProps) {
  return (
    <TabScroller activeKey={activeCategory}>
      <Tabs
        value={activeCategory}
        onValueChange={(v) => onChange(v as BrowseFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </TabScroller>
  )
}
