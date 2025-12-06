"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe/images";
import type { Mod } from "@/lib/warframe/types";

// =============================================================================
// RANK COMPLETE LINE COMPONENT WITH ANIMATION
// =============================================================================

function RankCompleteLine({
  rarity,
  className,
}: {
  rarity: ModRarity;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/mod-components/${RARITY_ASSET_MAP[rarity].folder}/RankCompleteLine.png`}
        alt="Max Rank"
        className="w-full"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
          maskSize: "0% 100%",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
          WebkitMaskSize: "0% 100%",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          animation: "rankReveal 0.4s ease-out forwards",
        }}
      />
      <style jsx>{`
        @keyframes rankReveal {
          0% {
            mask-size: 0% 100%;
            -webkit-mask-size: 0% 100%;
          }
          100% {
            mask-size: 200% 100%;
            -webkit-mask-size: 200% 100%;
          }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// RARITY TYPES
// =============================================================================

type ModRarity = "Common" | "Uncommon" | "Rare" | "Legendary" | "Peculiar";

// Map rarity to asset folder and prefix
const RARITY_ASSET_MAP: Record<ModRarity, { folder: string; prefix: string }> =
  {
    Common: { folder: "common", prefix: "Bronze" },
    Uncommon: { folder: "uncommon", prefix: "Silver" },
    Rare: { folder: "rare", prefix: "Gold" },
    Legendary: { folder: "legendary", prefix: "Legendary" },
    Peculiar: { folder: "legendary", prefix: "Legendary" }, // Peculiar uses Legendary assets
  };

// Map rarity to text color
const RARITY_COLOR_MAP: Record<ModRarity, string> = {
  Common: "#C79989",
  Uncommon: "#BEC0C2",
  Rare: "#FBECC4",
  Legendary: "#DFDFDF",
  Peculiar: "#DFDFDF", // Peculiar uses Legendary color
};

function getModAssetUrl(rarity: ModRarity, asset: string): string {
  const { folder, prefix } = RARITY_ASSET_MAP[rarity];
  return `/mod-components/${folder}/${prefix}${asset}.png`;
}

// =============================================================================
// MOD CARD COMPONENT
// =============================================================================

export interface ModCardProps {
  mod: Mod;
  rank?: number;
  onRankChange?: (rank: number) => void;
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  className?: string;
}

// Helper to get first stat at a given rank
function getModStat(mod: Mod, rank: number): string | null {
  if (!mod.levelStats || mod.levelStats.length === 0) return null;
  const levelIndex = Math.min(rank, mod.levelStats.length - 1);
  const stats = mod.levelStats[levelIndex]?.stats;
  return stats?.[0] ?? null;
}

export function ModCard({
  mod,
  rank: externalRank,
  onRankChange,
  className,
}: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [internalRank, setInternalRank] = useState(0);
  const rarity = (mod.rarity as ModRarity) ?? "Common";

  // Use external rank if provided, otherwise use internal state
  const currentRank = externalRank ?? internalRank;
  const maxRank = mod.fusionLimit ?? 0;
  const isMaxRank = currentRank >= maxRank;

  const handleRankChange = useCallback(
    (newRank: number) => {
      const clampedRank = Math.max(0, Math.min(newRank, maxRank));
      if (onRankChange) {
        onRankChange(clampedRank);
      } else {
        setInternalRank(clampedRank);
      }
    },
    [maxRank, onRankChange]
  );

  // Handle keyboard events for rank adjustment
  useEffect(() => {
    if (!isHovered) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleRankChange(currentRank - 1);
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handleRankChange(currentRank + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHovered, currentRank, handleRankChange]);

  return (
    <div
      className={cn("relative w-[184px] h-[64px]", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Compact card - hidden when hovered */}
      <div
        className={cn(
          "transition-opacity duration-200",
          isHovered ? "opacity-0" : "opacity-100"
        )}
      >
        <CompactModCard
          mod={mod}
          rarity={rarity}
          rank={currentRank}
          isMaxRank={isMaxRank}
        />
      </div>

      {/* Expanded card overlays, centered vertically on the compact card */}
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none",
          "transition-all duration-200 ease-out origin-center",
          "drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] shadow-2xl",
          isHovered
            ? "opacity-100 scale-100"
            : "opacity-0 scale-75 pointer-events-none"
        )}
      >
        <ExpandedModCard
          mod={mod}
          rarity={rarity}
          rank={currentRank}
          isMaxRank={isMaxRank}
        />
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT MOD CARD (Just frames)
// =============================================================================

interface FrameCardProps {
  mod: Mod;
  rarity: ModRarity;
  rank: number;
  isMaxRank: boolean;
}

function CompactModCard({ mod, rarity, rank, isMaxRank }: FrameCardProps) {
  const maxRank = mod.fusionLimit ?? 0;

  return (
    <div className="relative w-[184px] h-[64px] flex items-center justify-center">
      {/* Mod Image */}
      <div className="absolute top-[4px] left-[3px] right-[3px] -bottom-4 z-10 overflow-hidden rounded-b-[5px]">
        <Image
          src={getImageUrl(mod.imageName)}
          alt={mod.name}
          fill
          className="object-cover object-top"
        />
      </div>
      {/* Top Frame */}
      <img
        src={getModAssetUrl(rarity, "FrameTop")}
        alt="Top Frame"
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-full"
      />
      {/* Mod Name */}
      <span
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-30 text-[16px] font-normal text-center max-w-[180px] whitespace-nowrap"
        style={{
          fontFamily: "Roboto, sans-serif",
          color: RARITY_COLOR_MAP[rarity],
          textShadow:
            "0 0 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,1)",
        }}
      >
        {mod.name}
      </span>
      {/* Bottom Frame */}
      <img
        src={getModAssetUrl(rarity, "FrameBottom")}
        alt="Bottom Frame"
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-20 w-full"
      />

      {/* Rank Complete Line - shown when at max rank, on bottom frame behind dots */}
      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute -bottom-[28px] left-1/2 -translate-x-1/2 z-25 w-[calc(100%-8px)]"
        />
      )}

      {/* Rank Dots - positioned on top of bottom frame */}
      {maxRank > 0 && (
        <div className="absolute -bottom-[27px] left-1/2 -translate-x-1/2 z-30 flex gap-0.5">
          {Array.from({ length: maxRank }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-[5px] h-[5px] rounded-full",
                i < rank ? "bg-[#a8d4ff]" : "bg-gray-800/60"
              )}
              style={
                i < rank
                  ? {
                      boxShadow: "0 0 2px 0.5px rgba(120, 180, 255, 0.6)",
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPANDED MOD CARD (Vertical frames, on hover)
// =============================================================================

function ExpandedModCard({ mod, rarity, rank, isMaxRank }: FrameCardProps) {
  const stat = getModStat(mod, rank); // Show stats for current rank
  const maxRank = mod.fusionLimit ?? 0;

  return (
    <div className="relative w-[184px] h-[285px]">
      {/* Top Frame */}
      <img
        src={getModAssetUrl(rarity, "FrameTop")}
        alt="Top Frame"
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-full"
      />

      {/* Mod Image - full card, will be covered by info panel at bottom */}
      <div className="absolute top-[4px] left-[3px] right-[3px] bottom-[4px] z-10 overflow-hidden">
        <Image
          src={getImageUrl(mod.imageName)}
          alt={mod.name}
          fill
          className="object-contain object-top"
        />
      </div>

      {/* Info Panel - positioned at bottom, sized by content */}
      <div className="absolute bottom-[20px] left-[3px] right-[3px] z-15">
        {/* Background Image - stretches to fill content */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={getModAssetUrl(rarity, "Background")}
            alt=""
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[200%] object-cover object-bottom"
          />
        </div>
        {/* Text Content */}
        <div className="relative z-20 flex flex-col items-center px-2 pt-3 pb-2">
          {/* Mod Name */}
          <span
            className="text-[14px] font-medium text-center leading-tight"
            style={{ color: RARITY_COLOR_MAP[rarity] }}
          >
            {mod.name}
          </span>
          {/* Stat */}
          {stat && (
            <span
              className="text-[11px] text-gray-300 text-center leading-tight mt-1"
              dangerouslySetInnerHTML={{ __html: stat }}
            />
          )}
          {/* Lower Tab with Compatibility Badge */}
          <div className="relative mt-4 w-[80%]">
            <img
              src={getModAssetUrl(rarity, "LowerTab")}
              alt=""
              className="w-full"
            />
            {mod.compatName && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wider text-white">
                {mod.compatName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Frame */}
      <img
        src={getModAssetUrl(rarity, "FrameBottom")}
        alt="Bottom Frame"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 w-full"
      />

      {/* Rank Complete Line - shown when at max rank, on bottom frame behind dots */}
      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute bottom-[3px] left-1/2 -translate-x-1/2 z-25 w-[calc(100%-8px)]"
        />
      )}

      {/* Rank Dots - positioned on top of bottom frame */}
      {maxRank > 0 && (
        <div className="absolute bottom-[4px] left-1/2 -translate-x-1/2 z-30 flex gap-0.5">
          {Array.from({ length: maxRank }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-[5px] h-[5px] rounded-full",
                i < rank ? "bg-[#a8d4ff]" : "bg-gray-800/60"
              )}
              style={
                i < rank
                  ? {
                      boxShadow: "0 0 2px 0.5px rgba(120, 180, 255, 0.6)",
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ModRarity };
