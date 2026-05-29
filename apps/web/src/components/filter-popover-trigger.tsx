import { Icons } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PopoverTrigger } from "@/components/ui/popover"

/** Shared "Filters" popover trigger: an outline button with a filter icon and
 *  an optional active-count badge. Render directly inside a <Popover>. */
export function FilterPopoverTrigger({ count }: { count: number }) {
  return (
    <PopoverTrigger
      render={<Button variant="outline" className="shrink-0 gap-2" />}
    >
      <Icons.filter data-icon="inline-start" />
      Filters
      {count > 0 && (
        <Badge variant="secondary" className="ml-1 text-xs">
          {count}
        </Badge>
      )}
    </PopoverTrigger>
  )
}
