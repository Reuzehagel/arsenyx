"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface ConditionalToggleProps {
  showMaxStacks: boolean
  onToggle: (value: boolean) => void
  hasConditionalMods: boolean
}

/**
 * Toggle for showing conditional mods at max stacks
 * Only visible when the build has conditional mods (Galvanized, on-kill, etc.)
 */
export function ConditionalToggle({
  showMaxStacks,
  onToggle,
  hasConditionalMods,
}: ConditionalToggleProps) {
  if (!hasConditionalMods) {
    return null
  }

  return (
    <div className="bg-muted/50 flex items-center justify-between gap-2 border-t border-b px-3 py-2">
      <Label
        htmlFor="max-stacks-toggle"
        className="text-muted-foreground cursor-pointer text-xs"
      >
        Show at max stacks
      </Label>
      <Switch
        id="max-stacks-toggle"
        checked={showMaxStacks}
        onCheckedChange={onToggle}
        className="origin-right scale-75"
      />
    </div>
  )
}
