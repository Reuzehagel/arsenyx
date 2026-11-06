import { cn } from "@/lib/util/utils"

export function CapacityBar({
  used,
  max,
  autoFormaCount,
  autoFormaNoFix,
  onAutoForma,
}: {
  used: number
  max: number
  /** Number of formas the auto-forma planner would apply. When > 0 and the
   * build is over capacity, a one-click button is rendered. */
  autoFormaCount?: number
  /** Set briefly to true after a fruitless click — flips the button into a
   * "No fix found" state so the user sees something happen. */
  autoFormaNoFix?: boolean
  onAutoForma?: () => void
}) {
  const pctVal = max > 0 ? Math.min(100, (used / max) * 100) : 0
  const over = used > max
  // Show the button whenever capacity is over. If the cheap reactive
  // planner found steps, label with the count and apply silently. If not,
  // label as "Auto-fix…" — clicking kicks off the heavier multi-variant
  // search (rearrangement + Omni Forma) and opens a preview dialog.
  const showAutoForma = over && !!onAutoForma
  const hasFastPlan = autoFormaCount !== undefined && autoFormaCount > 0
  const buttonLabel = autoFormaNoFix
    ? "No fix found"
    : hasFastPlan
      ? `Auto-forma (${autoFormaCount})`
      : "Auto-fix…"
  const buttonTitle = autoFormaNoFix
    ? "Even rearrangement and Omni Forma can't fit every variant — try lowering ranks or removing a mod"
    : hasFastPlan
      ? "Apply forma to the most expensive slots until capacity fits"
      : "Open a preview of the cross-variant fix (forma + rearrangement)"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Capacity</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            over && "text-destructive",
          )}
        >
          {used} / {max}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full transition-[width,background-color]",
            over ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pctVal}%` }}
        />
      </div>
      {showAutoForma && (
        <button
          type="button"
          onClick={onAutoForma}
          title={buttonTitle}
          className="text-muted-foreground hover:bg-accent/40 hover:text-foreground mt-1 inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs transition-colors"
        >
          {buttonLabel}
        </button>
      )}
    </div>
  )
}
