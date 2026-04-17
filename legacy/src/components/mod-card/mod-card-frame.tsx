/**
 * ModCardFrame - Unified frame renderer for all mod card variants
 *
 * Renders the PNG layers (frames, background) for mod cards.
 * All rarities are normalized to a consistent display width.
 */

import Image from "next/image"

import { cn } from "@/lib/utils"
import {
  type ModRarity,
  type CardVariant,
  DISPLAY_SIZE,
  getModAssetUrl,
  getRarityColor,
  ASSET_DIMENSIONS,
  getRarityGroup,
} from "@/lib/warframe/mod-card-config"

// =============================================================================
// TYPES
// =============================================================================

export interface ModCardFrameProps {
  rarity: ModRarity
  variant: CardVariant
  children?: React.ReactNode
  className?: string
}

// =============================================================================
// RANK COMPLETE LINE COMPONENT
// =============================================================================

interface RankCompleteLineProps {
  rarity: ModRarity
  className?: string
  disableAnimation?: boolean
}

export function RankCompleteLine({
  rarity,
  className,
  disableAnimation = false,
}: RankCompleteLineProps) {
  return (
    <div className={cn("pointer-events-none overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getModAssetUrl(rarity, "RankCompleteLine")}
        alt="Max Rank"
        className="w-full"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
          maskSize: disableAnimation ? "200% 100%" : "0% 100%",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
          WebkitMaskSize: disableAnimation ? "200% 100%" : "0% 100%",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          animation: disableAnimation
            ? "none"
            : "rankReveal 0.4s ease-out forwards",
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
  )
}

// =============================================================================
// RANK DOTS COMPONENT
// =============================================================================

interface RankDotsProps {
  rank: number
  maxRank: number
  variant: CardVariant
  className?: string
}

export function RankDots({ rank, maxRank, variant, className }: RankDotsProps) {
  if (maxRank === 0) return null

  const positionClass =
    variant === "compact"
      ? "absolute -bottom-[27px] left-1/2 -translate-x-1/2"
      : "absolute bottom-[4px] left-1/2 -translate-x-1/2"

  return (
    <div
      className={cn(
        positionClass,
        "pointer-events-none z-30 flex gap-0.5",
        className,
      )}
    >
      {Array.from({ length: maxRank }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-[5px] w-[5px] rounded-full",
            i < rank ? "bg-wf-rank-pip" : "bg-muted/60",
          )}
          style={
            i < rank
              ? { boxShadow: "0 0 2px 0.5px rgba(120, 180, 255, 0.6)" }
              : undefined
          }
        />
      ))}
    </div>
  )
}

// =============================================================================
// DRAIN BADGE COMPONENT
// =============================================================================

interface DrainBadgeProps {
  drain: number
  polarity: string
  rarity: ModRarity
  matchState?: "match" | "mismatch" | "neutral"
}

export function DrainBadge({
  drain,
  polarity,
  rarity,
  matchState = "neutral",
}: DrainBadgeProps) {
  const rarityColor = getRarityColor(rarity)
  const badgeColor =
    matchState === "match"
      ? "#4ade80"
      : matchState === "mismatch"
        ? "#f87171"
        : rarityColor
  const glow =
    matchState === "match"
      ? "0 0 8px rgba(74, 222, 128, 0.45)"
      : matchState === "mismatch"
        ? "0 0 8px rgba(248, 113, 113, 0.45)"
        : undefined

  const polarityIconUrl = `/focus-schools/${getPolarityFilename(polarity)}`

  return (
    <div className="absolute top-[7px] right-[2px] z-30 flex items-center justify-center">
      {/* Backer Image */}
      <Image
        src={getModAssetUrl(rarity, "TopRightBacker")}
        alt=""
        width={36}
        height={18}
        className="pointer-events-none"
        priority={false}
        unoptimized
      />

      {/* Content Container */}
      <div className="absolute inset-0 flex items-center justify-center gap-[1px] pt-[0.5px] pl-[3px]">
        {/* Drain Value */}
        <span
          className="text-[12px] leading-none font-bold tracking-tighter"
          style={{
            fontFamily: "Roboto, sans-serif",
            color: badgeColor,
            textShadow: glow,
          }}
        >
          {drain}
        </span>

        {/* Polarity Icon */}
        <div
          className="relative h-[13px] w-[13px]"
          style={{
            backgroundColor: badgeColor,
            maskImage: `url(${polarityIconUrl})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: `url(${polarityIconUrl})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
      </div>
    </div>
  )
}

function getPolarityFilename(polarity: string): string {
  const map: Record<string, string> = {
    madurai: "Madurai_Pol.svg",
    vazarin: "Vazarin_Pol.svg",
    naramon: "Naramon_Pol.svg",
    zenurik: "Zenurik_Pol.svg",
    unairu: "Unairu_Pol.svg",
    penjaga: "Penjaga_Pol.svg",
    umbra: "Umbra_Pol.svg",
    any: "Any_Pol.svg",
    universal: "Any_Pol.svg",
  }
  return map[polarity] || "Any_Pol.svg"
}

// =============================================================================
// MOD CARD FRAME COMPONENT
// =============================================================================

export function ModCardFrame({
  rarity,
  variant,
  children,
  className,
}: ModCardFrameProps) {
  const size = DISPLAY_SIZE[variant]
  const isExpanded = variant === "expanded"

  // Frame positioning differs by variant
  const frameBottomPosition = isExpanded
    ? "absolute bottom-0 left-1/2 -translate-x-1/2"
    : "absolute -bottom-8 left-1/2 -translate-x-1/2"

  const group = getRarityGroup(rarity)
  const topFrameDims = ASSET_DIMENSIONS[group].frameTop
  const bottomFrameDims = ASSET_DIMENSIONS[group].frameBottom

  return (
    <div
      className={cn("relative select-none", className)}
      style={{
        width: size.width,
        height: size.height,
        isolation: "isolate",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      {/* Background - only visible in expanded view */}
      {isExpanded && (
        <div className="absolute inset-x-[3px] top-[4px] bottom-[4px] z-5 overflow-hidden rounded-b-[20px]">
          <Image
            src={getModAssetUrl(rarity, "Background")}
            alt=""
            fill
            sizes="148px"
            className="object-cover object-bottom"
            priority={false}
            unoptimized
          />
        </div>
      )}

      {/* Top Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameTop")}
        alt=""
        width={topFrameDims.w}
        height={topFrameDims.h}
        className={cn(
          "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2",
          rarity === "Amalgam" || rarity === "Galvanized" || rarity === "Riven"
            ? "-top-2 h-auto w-[110%] max-w-none"
            : "top-0 w-full",
        )}
        priority={false}
        unoptimized
        {...(rarity === "Riven" ? { "data-riven-frame-star": "" } : {})}
      />
      {/* Riven no-star frame top (shown only in screenshot mode via CSS) */}
      {rarity === "Riven" && (
        <Image
          data-riven-frame-nostar
          src="/mod-components/riven/RivenFrameTopNoStar.png"
          alt=""
          width={topFrameDims.w}
          height={topFrameDims.h}
          className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden h-auto w-[110%] max-w-none -translate-x-1/2"
          priority={false}
          unoptimized
        />
      )}

      {/* Content area - mod image, stats, etc */}
      {children}

      {/* Bottom Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameBottom")}
        alt=""
        width={bottomFrameDims.w}
        height={bottomFrameDims.h}
        className={cn(
          frameBottomPosition,
          "pointer-events-none z-20 w-full",
          rarity === "Amalgam" || rarity === "Galvanized" || rarity === "Riven"
            ? "h-auto w-[110%] max-w-none"
            : "w-full",
        )}
        priority={false}
        unoptimized
      />
    </div>
  )
}

// =============================================================================
// LOWER TAB COMPONENT (for expanded view)
// =============================================================================

interface LowerTabProps {
  label?: string
  rarity: ModRarity
  className?: string
}

export function LowerTab({ label, rarity, className }: LowerTabProps) {
  if (!label) return null

  return (
    <div className={cn("relative h-[22px] w-[80%]", className)}>
      <Image
        src={getModAssetUrl(rarity, "LowerTab")}
        alt=""
        fill
        sizes="148px"
        className="object-contain"
        priority={false}
        unoptimized
      />
      <span className="absolute inset-0 flex items-center justify-center text-[9px] tracking-wider text-white uppercase">
        {label}
      </span>
    </div>
  )
}
