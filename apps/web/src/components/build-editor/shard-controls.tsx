import { ChevronLeft, Plus, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatStatValue,
  getShardImageUrl,
  SHARD_COLOR_NAMES,
  SHARD_COLORS,
  SHARD_CSS_COLORS,
  SHARD_STATS,
  type PlacedShard,
  type ShardColor,
} from "@/lib/shards"
import { cn } from "@/lib/util/utils"

export function ShardSlot({
  shard,
  onPick,
  readOnly = false,
}: {
  shard: PlacedShard | null
  onPick: (s: PlacedShard | null) => void
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const stat = shard
    ? (SHARD_STATS[shard.color].find((s) => s.name === shard.stat) ?? null)
    : null
  const triggerButton = (
    <button
      type="button"
      className={cn(
        "relative flex size-10 items-center justify-center rounded-sm border transition-colors",
        shard
          ? "bg-muted/40 border-border hover:border-muted-foreground/60"
          : "border-muted-foreground/10 hover:border-muted-foreground/25 border-dashed",
      )}
    >
      {shard ? (
        <img
          src={getShardImageUrl(shard.color, shard.tauforged)}
          alt=""
          className="size-9"
        />
      ) : (
        <Plus className="text-muted-foreground/20 size-4" />
      )}
    </button>
  )

  return (
    <Popover
      open={open}
      onOpenChange={!readOnly || shard ? setOpen : undefined}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            !readOnly || shard ? (
              <PopoverTrigger render={triggerButton} />
            ) : (
              triggerButton
            )
          }
        />
        <TooltipContent side="bottom">
          {shard ? (
            <>
              <p className="font-semibold">
                {shard.tauforged ? "Tauforged " : ""}
                <span style={{ color: SHARD_CSS_COLORS[shard.color] }}>
                  {SHARD_COLOR_NAMES[shard.color]}
                </span>
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {shard.stat}
              </p>
            </>
          ) : (
            <span className="text-muted-foreground">Empty shard slot</span>
          )}
        </TooltipContent>
      </Tooltip>
      {(!readOnly || shard) && (
        <PopoverContent
          side={readOnly ? "bottom" : "right"}
          align={readOnly ? "center" : "start"}
          className={readOnly ? "w-64" : "w-72"}
        >
          {readOnly && shard ? (
            <div className="flex items-center gap-2.5">
              <img
                src={getShardImageUrl(shard.color, shard.tauforged)}
                alt=""
                className="size-10 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">
                  {shard.tauforged ? "Tauforged " : ""}
                  <span style={{ color: SHARD_CSS_COLORS[shard.color] }}>
                    {SHARD_COLOR_NAMES[shard.color]}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {shard.stat}
                  {stat ? ` · ${formatStatValue(stat, shard.tauforged)}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <ShardPicker
              current={shard}
              onPick={(s) => {
                onPick(s)
                setOpen(false)
              }}
              onClear={() => {
                onPick(null)
                setOpen(false)
              }}
            />
          )}
        </PopoverContent>
      )}
    </Popover>
  )
}

function ShardPicker({
  current,
  onPick,
  onClear,
}: {
  current: PlacedShard | null
  onPick: (s: PlacedShard) => void
  onClear: () => void
}) {
  const [color, setColor] = useState<ShardColor | null>(current?.color ?? null)
  const [tauforged, setTauforged] = useState(current?.tauforged ?? true)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {color && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setColor(null)}
              title="Back"
              className="-ml-1"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
          )}
          <span className="text-xs font-medium">
            {color ? "Select Stat" : "Select Color"}
          </span>
        </div>
        {current && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            title="Remove shard"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {!color && (
        <div className="grid grid-cols-3 gap-1">
          {SHARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="hover:bg-muted flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors"
            >
              <img src={getShardImageUrl(c, false)} alt="" className="size-8" />
              <span className="text-[10px]">{SHARD_COLOR_NAMES[c]}</span>
            </button>
          ))}
        </div>
      )}

      {color && (
        <>
          <label className="hover:bg-muted flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 text-xs transition-colors">
            <span className="text-muted-foreground">Tauforged (1.5×)</span>
            <Switch
              size="sm"
              checked={tauforged}
              onCheckedChange={setTauforged}
            />
          </label>

          <div className="flex flex-col gap-0.5">
            {SHARD_STATS[color].map((s) => {
              const isActive =
                current?.color === color &&
                current.stat === s.name &&
                current.tauforged === tauforged
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => onPick({ color, stat: s.name, tauforged })}
                  className={cn(
                    "hover:bg-muted flex items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors",
                    isActive && "bg-muted",
                  )}
                >
                  <span>{s.name}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatStatValue(s, tauforged)}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
