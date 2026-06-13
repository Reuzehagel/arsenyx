import type { ComponentProps } from "react"

import { cn } from "@/lib/util/utils"

/**
 * Shared tab button for the build-variant bars — the read-only `VariantTabs`,
 * the editor's `EditorVariantBar`, and the guide `ScopeChip`s. Centralizes the
 * active/inactive "primary fill" styling plus the `role="tab"`/`aria-selected`
 * semantics so the three bars can't drift. Per-bar shape (padding, rounding,
 * `inline-flex`) is passed through `className`.
 *
 * Lives under `build-viewer/` so the dependency direction stays editor →
 * viewer, keeping it safe for the read-only embed bundle (it only pulls in
 * `cn`).
 */
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
        "border transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
