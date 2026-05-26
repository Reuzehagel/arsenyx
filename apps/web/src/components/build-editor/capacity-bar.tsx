import { cn } from "@/lib/util/utils"

export function CapacityBar({
  used,
  max,
  autoFormaCount,
  autoFormaStage,
  onAutoForma,
}: {
  used: number
  max: number
  /** Number of formas the auto-forma planner would apply. When > 0 and the
   * build is over capacity, a one-click button is rendered. */
  autoFormaCount?: number
  /** Stage 1 = silent apply (label "Auto-forma (N)"). Stages 2/3 open a
   * confirm dialog (label "Auto-fix…"). */
  autoFormaStage?: 1 | 2 | 3
  onAutoForma?: () => void
}) {
  const pctVal = max > 0 ? Math.min(100, (used / max) * 100) : 0
  const over = used > max
  const showAutoForma =
    over && onAutoForma && autoFormaCount !== undefined && autoFormaCount > 0
  const buttonLabel =
    autoFormaStage === 1 || autoFormaStage === undefined
      ? `Auto-forma (${autoFormaCount})`
      : "Auto-fix…"
  const buttonTitle =
    autoFormaStage === 1 || autoFormaStage === undefined
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
            "h-full transition-all",
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
