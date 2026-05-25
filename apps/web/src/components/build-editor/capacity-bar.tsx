import { cn } from "@/lib/util/utils"

export function CapacityBar({ used, max }: { used: number; max: number }) {
  const pctVal = max > 0 ? Math.min(100, (used / max) * 100) : 0
  const over = used > max
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
    </div>
  )
}
