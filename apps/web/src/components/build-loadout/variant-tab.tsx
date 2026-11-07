import type { ComponentProps } from "react"

import { cn } from "@/lib/util/utils"

/**
 * Shared tab button for the build-variant bars — the read-only `VariantTabs`,
 * the editor's `EditorVariantBar`, and the guide `ScopeChip`s. A segment in a
 * `VARIANT_TRACK` (the same look as the house Tabs): the active one is a
 * raised chip, the rest are plain text. Centralizes that styling plus the
 * `role="tab"`/`aria-selected` semantics so the three bars can't drift.
 */
/** The track the tabs sit in. */
export const VARIANT_TRACK =
  "bg-muted inline-flex flex-wrap items-center justify-center gap-0.5 rounded-lg p-[3px]"

export function VariantTab({
  active,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-background text-foreground dark:border-input dark:bg-input/30 border-transparent shadow-sm"
          : "text-muted-foreground hover:text-foreground border-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
