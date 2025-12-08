"use client";

import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe/images";
import type { BuildState } from "@/lib/warframe/types";
import type { CapacityStatus } from "@/lib/warframe/capacity";
import {
  Zap,
  Heart,
  Shield,
  Wind,
  Timer,
  Activity,
  Maximize,
  BicepsFlexed,
  ShieldPlus,
} from "lucide-react";

interface ItemStats {
  health?: number;
  shield?: number;
  armor?: number;
  energy?: number;
  sprintSpeed?: number;
  abilities?: Array<{ name: string; imageName?: string }>;
}

interface ItemSidebarProps {
  buildState: BuildState;
  capacityStatus: CapacityStatus;
  onToggleReactor: () => void;
  onCopyBuild: () => void;
  onClearBuild: () => void;
  showCopied: boolean;
  itemStats?: ItemStats;
}

export function ItemSidebar({
  buildState,
  capacityStatus,
  onToggleReactor,
  itemStats,
}: ItemSidebarProps) {
  const isWarframeOrNecramech =
    buildState.itemCategory === "warframes" ||
    buildState.itemCategory === "necramechs";

  // Calculate used and max capacity
  const usedCapacity = capacityStatus.max - capacityStatus.remaining;
  const maxCapacity = capacityStatus.max;

  // Get abilities from item stats
  const abilities = itemStats?.abilities ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Abilities */}
      {isWarframeOrNecramech && abilities.length > 0 && (
        <div className="p-3 flex gap-3">
          {abilities.slice(0, 4).map((ability, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded bg-muted border overflow-hidden relative"
              title={ability.name}
            >
              {ability.imageName ? (
                <Image
                  src={getImageUrl(ability.imageName)}
                  alt={ability.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  {i + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Capacity */}
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Reactor</span>
          <Switch
            checked={buildState.hasReactor}
            onCheckedChange={onToggleReactor}
            className="scale-75 origin-right"
          />
        </div>

        <div className="space-y-1">
          <div className="h-4 bg-muted rounded-full overflow-hidden relative">
            <div
              className={cn(
                "h-full transition-all duration-200 rounded-full",
                capacityStatus.remaining < 0 ? "bg-destructive" : "bg-primary"
              )}
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, (usedCapacity / maxCapacity) * 100)
                )}%`,
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
              {usedCapacity}/{maxCapacity}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Base Stats */}
      <div className="p-3 space-y-2">
        <StatRow
          label="Energy"
          value={itemStats?.energy?.toString() ?? "—"}
          icon={<Zap className="w-3 h-3" />}
        />
        <StatRow
          label="Health"
          value={itemStats?.health?.toString() ?? "—"}
          icon={<Heart className="w-3 h-3" />}
        />
        <StatRow
          label="Shield"
          value={itemStats?.shield?.toString() ?? "—"}
          icon={<Shield className="w-3 h-3" />}
        />
        <StatRow
          label="Armor"
          value={itemStats?.armor?.toString() ?? "—"}
          icon={<ShieldPlus className="w-3 h-3" />}
        />
        <StatRow
          label="Sprint Speed"
          value={itemStats?.sprintSpeed?.toFixed(2) ?? "—"}
          icon={<Wind className="w-3 h-3" />}
        />
      </div>

      <Separator />

      {/* Ability Stats */}
      {isWarframeOrNecramech && (
        <div className="p-3 space-y-2">
          <StatRow
            label="Duration"
            value="100%"
            icon={<Timer className="w-3 h-3" />}
          />
          <StatRow
            label="Efficiency"
            value="100%"
            icon={<Activity className="w-3 h-3" />}
          />
          <StatRow
            label="Range"
            value="100%"
            icon={<Maximize className="w-3 h-3" />}
          />
          <StatRow
            label="Strength"
            value="100%"
            icon={<BicepsFlexed className="w-3 h-3" />}
          />
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
