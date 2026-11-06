import type { BrowseFilter } from "@arsenyx/shared/seo/browse-meta"

import { TabScroller } from "@/components/tab-scroller"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CATEGORIES } from "@/lib/catalog"

/** Category tab bar: an "All" tab plus one tab per category. */
export function CategoryTabs({
  value,
  onChange,
}: {
  value: BrowseFilter
  onChange: (value: BrowseFilter) => void
}) {
  return (
    <TabScroller activeKey={value}>
      <Tabs value={value} onValueChange={(v) => onChange(v as BrowseFilter)}>
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
