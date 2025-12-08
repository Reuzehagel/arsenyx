"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ModCard } from "@/components/mod-card";
import { Minus, Plus } from "lucide-react";
import type { Mod } from "@/lib/warframe/types";

// =============================================================================
// SEARCHABLE MOD CARD COMPONENT
// =============================================================================

export interface SearchableModCardProps {
  mod: Mod;
  isDisabled?: boolean;
  isSelected?: boolean;
  onSelect: (mod: Mod, rank: number) => void;
  dataIndex?: number;
}

export function SearchableModCard({
  mod,
  isDisabled = false,
  isSelected = false,
  onSelect,
  dataIndex,
}: SearchableModCardProps) {
  const maxRank = mod.fusionLimit ?? 0;
  const [rank, setRank] = useState(maxRank);
  const [isHovered, setIsHovered] = useState(false);

  const handleDecreaseRank = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (rank > 0) {
        setRank(rank - 1);
      }
    },
    [rank]
  );

  const handleIncreaseRank = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (rank < maxRank) {
        setRank(rank + 1);
      }
    },
    [rank, maxRank]
  );

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onSelect(mod, rank);
    }
  }, [isDisabled, mod, rank, onSelect]);

  // Handle keyboard +/- when hovered
  useEffect(() => {
    if (!isHovered || isDisabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setRank((r) => Math.max(0, r - 1));
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setRank((r) => Math.min(maxRank, r + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHovered, isDisabled, maxRank]);

  return (
    <div
      data-index={dataIndex}
      className={cn(
        "relative flex flex-col items-center cursor-pointer transition-all rounded-lg p-2 group",
        "bg-card/30 border border-transparent",
        isDisabled && "opacity-40 grayscale cursor-not-allowed",
        isHovered ? "z-50" : "z-0"
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Use the real ModCard component; keep hover effects */}
      <div>
        <ModCard mod={mod} rank={rank} isSelected={isSelected} />
      </div>

      {/* Rank Controls - Show on hover when mod has ranks */}
      {maxRank > 0 && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 mt-2 transition-opacity",
            isHovered && !isDisabled ? "opacity-100" : "opacity-0"
          )}
        >
          <button
            onClick={handleDecreaseRank}
            disabled={rank <= 0 || isDisabled}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded bg-muted/50 hover:bg-muted transition-colors pointer-events-auto",
              (rank <= 0 || isDisabled) && "opacity-30 cursor-not-allowed"
            )}
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-mono min-w-[40px] text-center text-muted-foreground">
            {rank}/{maxRank}
          </span>
          <button
            onClick={handleIncreaseRank}
            disabled={rank >= maxRank || isDisabled}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded bg-muted/50 hover:bg-muted transition-colors pointer-events-auto",
              (rank >= maxRank || isDisabled) && "opacity-30 cursor-not-allowed"
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Disabled Overlay removed: no 'In Use' tag rendered */}
    </div>
  );
}
