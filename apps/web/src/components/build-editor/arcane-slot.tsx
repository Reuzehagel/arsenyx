import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Arcane slot tile. Empty-only placeholder — click-to-place lands in a later slice.
 * Sized slightly narrower than mod slots to match the legacy editor.
 */
export function ArcaneSlot() {
  return (
    <div
      className={cn(
        "border-muted-foreground/20 bg-muted/20 relative flex h-[80px] flex-1 flex-col items-center justify-center rounded-md border-2 border-dashed",
        "sm:h-[90px] sm:w-[120px] sm:flex-none md:h-[100px] md:w-[140px]",
      )}
    >
      <Plus className="text-muted-foreground/20 size-6" />
      <span className="text-muted-foreground/50 mt-1 font-mono text-[10px] uppercase tracking-wide">
        Arcane
      </span>
    </div>
  );
}
