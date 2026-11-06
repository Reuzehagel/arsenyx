import { LayoutGrid, Rows3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useBuildLayout } from "@/lib/hooks/use-build-layout"
import { cn } from "@/lib/util/utils"

export function BuildsLayoutToggle() {
  const [layout, setLayout] = useBuildLayout()
  return (
    <div className="bg-card inline-flex shrink-0 items-center rounded-md border p-px">
      <ToggleButton
        active={layout === "cards"}
        label="Card view"
        onClick={() => setLayout("cards")}
      >
        <LayoutGrid className="size-4" />
      </ToggleButton>
      <ToggleButton
        active={layout === "rows"}
        label="Row view"
        onClick={() => setLayout("rows")}
      >
        <Rows3 className="size-4" />
      </ToggleButton>
    </div>
  )
}

function ToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("h-7 w-8 px-0", active && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  )
}
