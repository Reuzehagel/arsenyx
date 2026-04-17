import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, Plus, Undo2, X, Zap } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  helminthQuery,
  type HelminthAbility,
} from "@/lib/helminth-query";
import {
  formatStatValue,
  getShardImageUrl,
  SHARD_COLOR_NAMES,
  SHARD_COLORS,
  SHARD_STATS,
  sumShardFlatBonuses,
  type PlacedShard,
  type ShardColor,
} from "@/lib/shards";
import { cn } from "@/lib/utils";
import {
  type BrowseCategory,
  type DetailItem,
  getImageUrl,
} from "@/lib/warframe";

const SHARD_SLOTS = 5;

export interface ItemSidebarProps {
  item: DetailItem;
  category: BrowseCategory;
  capacityUsed: number;
  capacityMax: number;
  capacityAuraBonus: number;
  hasReactor: boolean;
  onToggleReactor: () => void;
  shards: (PlacedShard | null)[];
  onSetShard: (index: number, shard: PlacedShard | null) => void;
  helminth: Record<number, HelminthAbility>;
  onSetHelminth: (slotIndex: number, ability: HelminthAbility | null) => void;
}

export function ItemSidebar({
  item,
  category,
  capacityUsed,
  capacityMax,
  capacityAuraBonus,
  hasReactor,
  onToggleReactor,
  shards,
  onSetShard,
  helminth,
  onSetHelminth,
}: ItemSidebarProps) {
  const isWarframe = category === "warframes" || category === "necramechs";
  const isPureWarframe = category === "warframes";
  const isWeapon =
    category === "primary" ||
    category === "secondary" ||
    category === "melee" ||
    category === "companion-weapons" ||
    category === "archwing" ||
    category === "exalted-weapons";
  const showShards = category === "warframes";
  const abilities = item.abilities ?? [];
  const boosterLabel = isWarframe ? "Reactor" : "Catalyst";
  const shardBonuses = sumShardFlatBonuses(shards);

  return (
    <div className="flex h-full flex-col">
      {isWarframe && abilities.length > 0 && (
        <>
        <div className="flex justify-around p-3">
          {abilities.slice(0, 4).map((a, i) => {
            const replaced = helminth[i];
            const displayed = replaced
              ? {
                  uniqueName: replaced.uniqueName,
                  name: replaced.name,
                  description: replaced.description,
                  imageName: replaced.imageName,
                }
              : a;
            return (
              <AbilityIcon
                key={i}
                ability={displayed}
                isHelminth={Boolean(replaced)}
                canSubsume={isPureWarframe}
                onSelectHelminth={(ab) => onSetHelminth(i, ab)}
              />
            );
          })}
        </div>
        <Separator />
        </>
      )}

      {showShards && (
        <>
          <div className="flex justify-around p-3">
            {Array.from({ length: SHARD_SLOTS }).map((_, i) => (
              <ShardSlot
                key={i}
                shard={shards[i] ?? null}
                onPick={(s) => onSetShard(i, s)}
              />
            ))}
          </div>
          <Separator />
        </>
      )}

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{boosterLabel}</span>
          <Switch
            size="sm"
            checked={hasReactor}
            onCheckedChange={onToggleReactor}
          />
        </div>

        <CapacityBar
          used={capacityUsed}
          max={capacityMax}
          auraBonus={capacityAuraBonus}
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-2 p-3">
        {isWarframe && (
          <>
            <StatsBlock
              rows={[
                ["Health", item.health, shardBonuses.health, ""],
                ["Shield", item.shield, shardBonuses.shield, ""],
                ["Armor", item.armor, shardBonuses.armor, ""],
                ["Energy", item.power, shardBonuses.energy, ""],
                ["Sprint", item.sprintSpeed, 0, ""],
              ]}
            />

            <Separator />

            <StatsBlock
              rows={[
                ["Duration", 100, 0, "%"],
                ["Efficiency", 100, 0, "%"],
                ["Range", 100, 0, "%"],
                ["Strength", 100, 0, "%"],
              ]}
            />
          </>
        )}
        {isWeapon && (
          <StatsBlock
            rows={[
              ["Damage", item.totalDamage, 0, ""],
              ["Crit Chance", pct(item.criticalChance), 0, ""],
              [
                "Crit Multi",
                item.criticalMultiplier
                  ? `${item.criticalMultiplier}x`
                  : undefined,
                0,
                "",
              ],
              ["Status", pct(item.procChance), 0, ""],
              ["Fire Rate", item.fireRate, 0, ""],
              ["Magazine", item.magazineSize, 0, ""],
              [
                "Reload",
                item.reloadTime !== undefined
                  ? `${parseFloat(item.reloadTime.toFixed(2))}s`
                  : undefined,
                0,
                "",
              ],
            ]}
          />
        )}
      </div>
    </div>
  );
}

function AbilityIcon({
  ability,
  isHelminth,
  canSubsume,
  onSelectHelminth,
}: {
  ability: { name: string; description: string; imageName?: string };
  isHelminth: boolean;
  canSubsume: boolean;
  onSelectHelminth: (ability: HelminthAbility | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerButton = (
    <button
      type="button"
      className={cn(
        "bg-muted relative size-10 overflow-hidden rounded border transition-colors",
        isHelminth
          ? "border-destructive/60"
          : "border-border hover:border-muted-foreground/60",
      )}
    >
      {ability.imageName ? (
        <img
          src={getImageUrl(ability.imageName)}
          alt={ability.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center">
          <Zap className="size-4" />
        </div>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger render={triggerButton} />}
        />
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-semibold">{ability.name}</p>
          <p className="text-muted-foreground mt-0.5 whitespace-pre-line">
            {ability.description}
          </p>
        </TooltipContent>
      </Tooltip>
      {canSubsume && (
        <PopoverContent side="bottom" align="center" className="w-72">
          <Suspense
            fallback={
              <p className="text-muted-foreground text-xs">Loading…</p>
            }
          >
            <HelminthPicker
              isHelminth={isHelminth}
              onPick={(ab) => {
                onSelectHelminth(ab);
                setOpen(false);
              }}
            />
          </Suspense>
        </PopoverContent>
      )}
    </Popover>
  );
}

function HelminthPicker({
  isHelminth,
  onPick,
}: {
  isHelminth: boolean;
  onPick: (ability: HelminthAbility | null) => void;
}) {
  const { data } = useSuspenseQuery(helminthQuery);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[10px] font-medium uppercase">
        Helminth
      </span>
      {isHelminth && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPick(null)}
          className="justify-start gap-2"
        >
          <Undo2 className="size-3" />
          Restore Original
        </Button>
      )}
      <Input
        placeholder="Search abilities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((a) => (
          <button
            key={a.uniqueName}
            type="button"
            onClick={() => onPick(a)}
            className="hover:bg-muted flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors"
          >
            {a.imageName ? (
              <img
                src={getImageUrl(a.imageName)}
                alt=""
                className="size-6 shrink-0 rounded-sm"
              />
            ) : (
              <div className="bg-muted size-6 shrink-0 rounded-sm" />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{a.name}</span>
              <span className="text-muted-foreground truncate text-[10px]">
                {a.source}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="text-muted-foreground px-1.5 py-1 text-xs">
            No matches.
          </span>
        )}
      </div>
    </div>
  );
}

function CapacityBar({
  used,
  max,
  auraBonus,
}: {
  used: number;
  max: number;
  auraBonus: number;
}) {
  const pctVal = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const over = used > max;
  return (
    <Popover>
      <PopoverTrigger
        render={<div className="flex cursor-help flex-col gap-1.5" />}
      >
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
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-56 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base</span>
          <span className="tabular-nums">{max - auraBonus}</span>
        </div>
        {auraBonus > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aura bonus</span>
            <span className="tabular-nums">+{auraBonus}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{max}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Used</span>
          <span className="tabular-nums">{used}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatsBlock({
  rows,
}: {
  rows: [string, string | number | undefined, number, string][];
}) {
  const shown = rows.filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-xs">
      {shown.map(([label, v, bonus, unit]) => (
        <StatRow
          key={label}
          label={label}
          value={v}
          bonus={bonus}
          unit={unit}
        />
      ))}
    </div>
  );
}

function StatRow({
  label,
  value,
  bonus,
  unit,
}: {
  label: string;
  value: string | number | undefined;
  bonus: number;
  unit: string;
}) {
  const isNum = typeof value === "number";
  const base = isNum ? (value as number) : undefined;
  const total = isNum && bonus ? (base as number) + bonus : undefined;
  const hasBonus = isNum && bonus > 0;
  const display = hasBonus
    ? `${formatNum(total!)}${unit}`
    : isNum
      ? `${formatNum(base!)}${unit}`
      : (value as string);

  const row = (
    <div
      className={cn(
        "flex items-baseline justify-between",
        hasBonus && "cursor-help",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          hasBonus && "text-primary",
        )}
      >
        {display}
      </span>
    </div>
  );

  if (!hasBonus) return row;

  return (
    <Popover>
      <PopoverTrigger render={row} />
      <PopoverContent side="right" align="start" className="w-48 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base</span>
          <span className="tabular-nums">{formatNum(base!)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shards</span>
          <span className="tabular-nums">+{formatNum(bonus)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatNum(total!)}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ShardSlot({
  shard,
  onPick,
}: {
  shard: PlacedShard | null;
  onPick: (s: PlacedShard | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerButton = (
    <button
      type="button"
      className={cn(
        "bg-muted/40 relative flex size-10 items-center justify-center rounded-md border transition-colors",
        shard
          ? "border-border hover:border-muted-foreground/60"
          : "border-muted-foreground/30 border-dashed hover:border-muted-foreground/60",
      )}
    >
      {shard ? (
        <img
          src={getShardImageUrl(shard.color, shard.tauforged)}
          alt=""
          className="size-9"
        />
      ) : (
        <Plus className="text-muted-foreground/60 size-4" />
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger render={triggerButton} />}
        />
        <TooltipContent side="bottom">
          {shard ? (
            <>
              <span className="font-semibold">
                {SHARD_COLOR_NAMES[shard.color]}
                {shard.tauforged ? " (Tauforged)" : ""}
              </span>
              <span className="text-muted-foreground"> — {shard.stat}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Empty shard slot</span>
          )}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="start" className="w-72">
        <ShardPicker
          current={shard}
          onPick={(s) => {
            onPick(s);
            setOpen(false);
          }}
          onClear={() => {
            onPick(null);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ShardPicker({
  current,
  onPick,
  onClear,
}: {
  current: PlacedShard | null;
  onPick: (s: PlacedShard) => void;
  onClear: () => void;
}) {
  const [color, setColor] = useState<ShardColor | null>(current?.color ?? null);
  const [tauforged, setTauforged] = useState(current?.tauforged ?? true);

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
                current.tauforged === tauforged;
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function pct(v: number | undefined): string | undefined {
  if (v === undefined) return undefined;
  return `${(v * 100).toFixed(1)}%`;
}

function formatNum(v: number): string {
  return Number.isInteger(v)
    ? v.toString()
    : parseFloat(v.toFixed(2)).toString();
}
