import { TabScroller } from "@/components/tab-scroller"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CATEGORIES } from "@/lib/warframe"

/** Shared category tab bar. Renders an "All" tab plus one tab per category.
 *  The active value and onChange use the raw tab string ("all" included);
 *  callers that model "all" as `undefined` adapt at the boundary. */
export function CategoryTabs({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <TabScroller activeKey={value}>
      <Tabs value={value} onValueChange={(v) => onChange(v)}>
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
