"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  setCount?: number;
}

// Helper to get stats at a given rank
function getModStats(mod: Mod, rank: number, setCount: number = 0): string[] {
  if (!mod.levelStats || mod.levelStats.length === 0) return [];
  const levelIndex = Math.min(rank, mod.levelStats.length - 1);
  const baseStats = mod.levelStats[levelIndex]?.stats ?? [];

  // Handle Umbral Set Bonus Scaling
  if (
    mod.modSet === "/Lotus/Upgrades/Mods/Sets/Umbra/UmbraSetMod" &&
    setCount > 1
  ) {
    // Determine multiplier
    let multiplier = 1.0;
    const isIntensify = mod.name.includes("Intensify");

    if (setCount === 2) {
      multiplier = isIntensify ? 1.25 : 1.3;
    } else if (setCount >= 3) {
      multiplier = isIntensify ? 1.75 : 1.8;
    }

    return baseStats.map((stat) => {
      // Regex to find numbers (including decimals)
      return stat.replace(/(\d+(\.\d+)?)/g, (match) => {
        const value = parseFloat(match);
        const boosted = value * multiplier;
        // Round to 1 decimal place, strip trailing zero
        return parseFloat(boosted.toFixed(1)).toString();
      });
    });
  }

  return baseStats;
}

export function ModCard({
  mod,
  rank: externalRank,
  onRankChange,
  isSelected,
  className,
  setCount = 0,
}: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  const maxRank = mod.fusionLimit ?? 0;
  const [internalRank, setInternalRank] = useState(maxRank);
  const rarity = (mod.rarity as ModRarity) ?? "Common";

  // Use external rank if provided, otherwise use internal state
  const currentRank = externalRank ?? internalRank;
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

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
      });
    }
    setIsHovered(true);
  };

  return (
    <div
      ref={cardRef}
      className={cn("relative w-[184px] h-[64px]", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Compact card - hidden when hovered */}
      <div
        className={cn(
          "transition-opacity duration-200",
          isHovered ? "opacity-0" : "opacity-100",
          isSelected && "filter drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
        )}
      >
        <CompactModCard
          mod={mod}
          rarity={rarity}
          rank={currentRank}
          isMaxRank={isMaxRank}
        />
      </div>

      {/* Expanded card overlays, portal to body to avoid clipping */}
      {isHovered &&
        portalContainer &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              top: coords.top,
              left: coords.left,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className={cn(
                "transition-all duration-200 ease-out origin-center",
                "drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] shadow-2xl",
                "animate-in fade-in zoom-in-75 duration-200"
              )}
            >
              <ExpandedModCard
                mod={mod}
                rarity={rarity}
                rank={currentRank}
                isMaxRank={isMaxRank}
                setCount={setCount}
              />
            </div>
          </div>,
          portalContainer
        )}
    </div>
  );
}

// =============================================================================
// COMPACT MOD CARD (Just frames)
// =============================================================================

export interface CompactModCardProps {
  mod: Mod;
  rarity: ModRarity;
  rank: number;
  isMaxRank: boolean;
}

export function CompactModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
}: CompactModCardProps) {
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

interface ExpandedModCardProps extends CompactModCardProps {
  setCount?: number;
}

function ExpandedModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  setCount = 0,
}: ExpandedModCardProps) {
  const stats = getModStats(mod, rank, setCount); // Show stats for current rank
  const maxRank = mod.fusionLimit ?? 0;
  const compatLabel =
    mod.compatName ||
    (mod.type ? mod.type.replace(" Mod", "").toUpperCase() : "");

  // Format stats: replace \n with <br/> and join multiple stats
  const formattedStats = stats
    .map((s) => s.replace(/\\n/g, "<br/>"))
    .join("<br/>");

  // Set Bonus Logic
  const setStats = mod.modSetStats || [];
  const maxSetSize = setStats.length;

  const currentBonusIndex = Math.min(Math.max(0, setCount - 1), maxSetSize - 1);
  const currentBonus =
    setStats.length > 0
      ? setStats[currentBonusIndex].replace(/\\n/g, "<br/>")
      : null;

  const showMax = maxSetSize > 1 && setCount < maxSetSize;
  const maxBonus =
    setStats.length > 0
      ? setStats[maxSetSize - 1].replace(/\\n/g, "<br/>")
      : null;

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
          {formattedStats && (
            <div className="flex flex-col items-center gap-1 mt-1 w-full px-1">
              <span
                className="text-[11px] text-gray-300 text-center leading-tight"
                dangerouslySetInnerHTML={{ __html: formattedStats }}
              />

              {/* Set Bonuses */}
              {setStats.length > 0 && (
                <div className="flex flex-col gap-1 mt-2 w-full border-t border-white/10 pt-1">
                  {/* Header with dots */}
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      Set ({setCount || 0}/{maxSetSize})
                    </span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: maxSetSize }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1 h-1 rounded-full border border-white/30",
                            i < setCount ? "bg-white" : "bg-transparent"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Current Bonus */}
                  <div className="flex flex-col gap-0.5">
                    {setCount > 0 && setCount < maxSetSize && (
                      <span className="text-[8px] text-gray-500 text-center uppercase">
                        Current
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[9px] text-center leading-tight",
                        setCount > 0 ? "text-gray-300" : "text-gray-500"
                      )}
                      dangerouslySetInnerHTML={{ __html: currentBonus! }}
                    />
                  </div>

                  {/* Max Bonus Preview */}
                  {showMax && maxBonus && (
                    <div className="flex flex-col gap-0.5 mt-1 opacity-60">
                      <span className="text-[8px] text-gray-500 text-center uppercase">
                        Max ({maxSetSize})
                      </span>
                      <span
                        className="text-[9px] text-gray-500 text-center leading-tight"
                        dangerouslySetInnerHTML={{ __html: maxBonus }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Lower Tab with Compatibility Badge */}
          <div className="relative mt-4 w-[80%]">
            <img
              src={getModAssetUrl(rarity, "LowerTab")}
              alt=""
              className="w-full"
            />
            {compatLabel && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wider text-white">
                {compatLabel}
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
