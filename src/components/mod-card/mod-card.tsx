"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe/images";
import type { Mod } from "@/lib/warframe/types";

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
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ModCard({ mod, className }: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rarity = (mod.rarity as ModRarity) ?? "Common";

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered ? (
        <ExpandedModCard mod={mod} rarity={rarity} />
      ) : (
        <CompactModCard mod={mod} rarity={rarity} />
      )}
    </div>
  );
}

// =============================================================================
// COMPACT MOD CARD (Just frames)
// =============================================================================

interface FrameCardProps {
  mod: Mod;
  rarity: ModRarity;
}

function CompactModCard({ mod, rarity }: FrameCardProps) {
  return (
    <div className="relative w-[158px] h-[55px] flex items-center justify-center">
      {/* Mod Image */}
      <div className="absolute top-[4px] left-[3px] right-[3px] -bottom-4 z-10 overflow-hidden">
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
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 text-[17px] font-normal text-[#C79989] text-center"
        style={{
          fontFamily: "Roboto, sans-serif",
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
    </div>
  );
}

// =============================================================================
// EXPANDED MOD CARD (Vertical frames, on hover)
// =============================================================================

function ExpandedModCard({ mod, rarity }: FrameCardProps) {
  return (
    <div className="relative w-[158px] h-[245px] flex items-center justify-center">
      {/* Mod Image */}
      <div className="absolute top-[4px] left-[3px] right-[3px] bottom-[4px] z-10 overflow-hidden">
        <Image
          src={getImageUrl(mod.imageName)}
          alt={mod.name}
          fill
          className="object-contain object-top"
        />
      </div>
      {/* Top Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameTop")}
        alt="Top Frame"
        width={158}
        height={50}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20"
      />
      {/* Bottom Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameBottom")}
        alt="Bottom Frame"
        width={158}
        height={50}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20"
      />
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ModRarity };
