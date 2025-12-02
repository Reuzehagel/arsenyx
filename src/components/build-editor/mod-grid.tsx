"use client";

import { useState } from "react";
import Image from "next/image";
import { getImageUrl } from "@/lib/warframe/images";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { calculateSlotDrain, getSlotPolarity } from "@/lib/warframe/capacity";
import type { ModSlot, Polarity } from "@/lib/warframe/types";
import { Plus } from "lucide-react";

interface ModGridProps {
  auraSlot?: ModSlot;
  exilusSlot: ModSlot;
  normalSlots: ModSlot[];
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  onRemoveMod: (slotId: string) => void;
  onApplyForma: (slotId: string, polarity: Polarity) => void;
  isWarframe: boolean;
}

export function ModGrid({
  auraSlot,
  exilusSlot,
  normalSlots,
  activeSlotId,
  onSelectSlot,
  onRemoveMod,
  isWarframe,
}: ModGridProps) {
  const [activeTab, setActiveTab] = useState<"mods" | "shards">("mods");

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab("mods")}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            activeTab === "mods"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Mods
        </button>
        <button
          onClick={() => setActiveTab("shards")}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            activeTab === "shards"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Shards
        </button>
      </div>

      {activeTab === "mods" ? (
        <div className="flex flex-col gap-4 items-center">
          {/* Row 1: Aura & Exilus */}
          <div className="flex gap-4 w-full justify-center">
            {isWarframe && auraSlot && (
              <ModSlotCard
                slot={auraSlot}
                isActive={activeSlotId === auraSlot.id}
                onSelect={() => onSelectSlot(auraSlot.id)}
                onRemove={() => onRemoveMod(auraSlot.id)}
                label="Aura"
                className="w-[180px] h-[90px]"
                horizontal
              />
            )}
            <ModSlotCard
              slot={exilusSlot}
              isActive={activeSlotId === exilusSlot.id}
              onSelect={() => onSelectSlot(exilusSlot.id)}
              onRemove={() => onRemoveMod(exilusSlot.id)}
              label="Exilus"
              className="w-[180px] h-[90px]"
              horizontal
            />
          </div>

          {/* Row 2: Normal Slots 1-4 */}
          <div className="flex gap-4 w-full justify-center">
            {normalSlots.slice(0, 4).map((slot, i) => (
              <ModSlotCard
                key={slot.id}
                slot={slot}
                isActive={activeSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
                onRemove={() => onRemoveMod(slot.id)}
                className="w-[180px] h-[90px]"
                horizontal
              />
            ))}
          </div>

          {/* Row 3: Normal Slots 5-8 */}
          <div className="flex gap-4 w-full justify-center">
            {normalSlots.slice(4, 8).map((slot, i) => (
              <ModSlotCard
                key={slot.id}
                slot={slot}
                isActive={activeSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
                onRemove={() => onRemoveMod(slot.id)}
                className="w-[180px] h-[90px]"
                horizontal
              />
            ))}
          </div>

          {/* Row 4: Arcanes (Placeholder for now as they are not in buildState yet fully) */}
          <div className="flex gap-4 w-full justify-center mt-2">
            <div className="w-[180px] h-[75px] border border-dashed rounded-lg flex items-center justify-center text-muted-foreground/30">
              <Plus className="w-6 h-6" />
            </div>
            <div className="w-[180px] h-[75px] border border-dashed rounded-lg flex items-center justify-center text-muted-foreground/30">
              <Plus className="w-6 h-6" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Archon Shards coming soon
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MOD SLOT CARD COMPONENT
// =============================================================================

interface ModSlotCardProps {
  slot: ModSlot;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  slotNumber?: number;
  className?: string;
  label?: string;
  horizontal?: boolean;
}

function ModSlotCard({
  slot,
  isActive,
  onSelect,
  onRemove,
  slotNumber,
  className,
  label,
  horizontal,
}: ModSlotCardProps) {
  const hasMod = !!slot.mod;
  const polarity = getSlotPolarity(slot);
  const drain = hasMod ? calculateSlotDrain(slot) : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative flex cursor-pointer transition-all rounded-lg overflow-hidden group",
              "bg-card border border-dashed border-border/60",
              isActive
                ? "border-primary ring-1 ring-primary/30"
                : "hover:border-primary/50 hover:bg-accent/5",
              hasMod && "border-solid border-border",
              horizontal
                ? "flex-row items-center p-2 gap-3"
                : "flex-col items-center justify-center",
              className
            )}
            onClick={onSelect}
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              if (hasMod) onRemove();
            }}
          >
            {/* Polarity Icon (Background) */}
            {polarity && !hasMod && (
              <div className="absolute right-2 top-2 opacity-20 pointer-events-none">
                <PolarityIcon polarity={polarity} className="text-xl" />
              </div>
            )}

            {/* Label (Aura/Exilus) */}
            {label && !hasMod && (
              <span className="absolute left-2 top-1 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                {label}
              </span>
            )}

            {hasMod ? (
              <>
                {/* Mod Image */}
                <div
                  className={cn(
                    "relative shrink-0",
                    horizontal ? "h-full aspect-[2/3]" : "w-full h-full p-1"
                  )}
                >
                  <Image
                    src={getImageUrl(slot.mod!.imageName)}
                    alt={slot.mod!.name}
                    fill
                    className="object-contain"
                  />
                </div>

                {/* Mod Info (Horizontal Layout) */}
                {horizontal && (
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <p className="text-sm font-medium truncate leading-tight">
                      {slot.mod!.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="uppercase tracking-wider">
                        {slot.mod!.rarity}
                      </span>
                      <span>•</span>
                      <span>Rank {slot.mod!.rank}</span>
                    </div>

                    {/* Drain & Polarity */}
                    <div className="flex items-center gap-1 mt-1">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1 py-0 h-4 font-mono",
                          polarity &&
                            slot.mod!.polarity === polarity &&
                            "bg-green-500/10 text-green-600 hover:bg-green-500/20",
                          polarity &&
                            slot.mod!.polarity !== polarity &&
                            "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                        )}
                      >
                        {drain}
                      </Badge>
                      {polarity && (
                        <PolarityIcon
                          polarity={polarity}
                          className="text-xs opacity-50"
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Empty State */
              <div className="flex items-center justify-center w-full h-full">
                <Plus className="w-5 h-5 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {hasMod ? (
            <div className="text-sm">
              <p className="font-medium">{slot.mod!.name}</p>
              <p className="text-muted-foreground">
                Rank {slot.mod!.rank}/{slot.mod!.fusionLimit} • Drain: {drain}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Right-click to remove
              </p>
            </div>
          ) : (
            <p>Click to add a mod</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// POLARITY ICON COMPONENT
// =============================================================================

interface PolarityIconProps {
  polarity: Polarity;
  className?: string;
}

function PolarityIcon({ polarity, className }: PolarityIconProps) {
  const iconMap: Record<Polarity, string> = {
    madurai: "V", // Damage
    vazarin: "D", // Defense
    naramon: "—", // Utility (dash)
    zenurik: "=", // Energy
    unairu: "R", // Resistance
    penjaga: "Y", // Sentinel
    umbra: "Ω", // Umbra (omega)
    universal: "○", // Universal (circle)
  };

  // Using currentColor for flexibility, but keeping map for reference if needed
  return (
    <span className={cn("font-bold font-mono", className)}>
      {iconMap[polarity]}
    </span>
  );
}

export { PolarityIcon };
