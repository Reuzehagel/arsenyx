"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ConditionalToggleProps {
  showMaxStacks: boolean;
  onToggle: (value: boolean) => void;
  hasConditionalMods: boolean;
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
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-t border-b">
      <Label
        htmlFor="max-stacks-toggle"
        className="text-xs text-muted-foreground cursor-pointer"
      >
        Show at max stacks
      </Label>
      <Switch
        id="max-stacks-toggle"
        checked={showMaxStacks}
        onCheckedChange={onToggle}
        className="scale-75 origin-right"
      />
    </div>
  );
}
