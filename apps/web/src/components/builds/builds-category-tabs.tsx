import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CATEGORIES, type BrowseCategory } from "@/lib/warframe"

const ALL = "all" as const

export function BuildsCategoryTabs({
  value,
  onChange,
}: {
  value: BrowseCategory | undefined
  onChange: (value: BrowseCategory | undefined) => void
}) {
  return (
    <Tabs
      value={value ?? ALL}
      onValueChange={(v) => {
        if (v === ALL) onChange(undefined)
        else onChange(v as BrowseCategory)
      }}
    >
      <TabsList>
        <TabsTrigger value={ALL}>All</TabsTrigger>
        {CATEGORIES.map((c) => (
          <TabsTrigger key={c.id} value={c.id}>
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
