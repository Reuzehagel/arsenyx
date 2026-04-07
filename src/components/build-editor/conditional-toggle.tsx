"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
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
    <>
      <Separator />
      <Field orientation="horizontal" className="bg-muted/50 justify-between px-3 py-2">
        <FieldLabel
          htmlFor="max-stacks-toggle"
          className="text-muted-foreground cursor-pointer text-xs"
        >
          Show at max stacks
        </FieldLabel>
        <Switch
          id="max-stacks-toggle"
          checked={showMaxStacks}
          onCheckedChange={onToggle}
          className="origin-right scale-75"
        />
      </Field>
      <Separator />
    </>
  )
}
