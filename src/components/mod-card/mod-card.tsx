"use client"

import Image from "next/image"
import { memo, useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getImageUrl, getPlaceholderUrl } from "@/lib/warframe/images"
import {
  type ModRarity,
  DISPLAY_SIZE,
  getRarityColor,
  getModAssetUrl,
} from "@/lib/warframe/mod-card-config"
import type { Mod } from "@/lib/warframe/types"

import {
  ModCardFrame,
  RankCompleteLine,
  RankDots,
  DrainBadge,
  LowerTab,
} from "./mod-card-frame"

const NUMBER_PATTERN = /(\d+(\.\d+)?)/g

// =============================================================================
// PROPS
// =============================================================================

export interface ModCardProps {
  mod: Mod
  rank?: number
  onRankChange?: (rank: number) => void
  isSelected?: boolean
  isDisabled?: boolean
  onClick?: () => void
  className?: string
  setCount?: number
  /** Skip hover expansion (used while dragging) */
  disableHover?: boolean
  /** Computed drain from slot (accounts for polarity) */
  drainOverride?: number
  /** Polarity match state for color feedback */
  matchState?: "match" | "mismatch" | "neutral"
}

// =============================================================================
// HELPERS
// =============================================================================

function getModStats(mod: Mod, rank: number, setCount: number = 0): string[] {
  if (!mod.levelStats || mod.levelStats.length === 0) return []
  const levelIndex = Math.min(rank, mod.levelStats.length - 1)
  const baseStats = mod.levelStats[levelIndex]?.stats ?? []

  // Handle Umbral Set Bonus Scaling
  if (
    mod.modSet === "/Lotus/Upgrades/Mods/Sets/Umbra/UmbraSetMod" &&
    setCount > 1
  ) {
    let multiplier = 1.0
    const isIntensify = mod.name.includes("Intensify")

    if (setCount === 2) {
      multiplier = isIntensify ? 1.25 : 1.3
    } else if (setCount >= 3) {
      multiplier = isIntensify ? 1.75 : 1.8
    }

    return baseStats.map((stat) => {
      return stat.replace(NUMBER_PATTERN, (match) => {
        const value = parseFloat(match)
        const boosted = value * multiplier
        return parseFloat(boosted.toFixed(1)).toString()
      })
    })
  }

  return baseStats
}

function normalizeRarity(rarity: string): ModRarity {
  const validRarities: ModRarity[] = [
    "Common",
    "Uncommon",
    "Rare",
    "Legendary",
    "Peculiar",
    "Riven",
    "Amalgam",
    "Galvanized",
  ]
  return validRarities.includes(rarity as ModRarity)
    ? (rarity as ModRarity)
    : "Common"
}

// =============================================================================
// MOD IMAGE WITH FALLBACK
// =============================================================================

interface ModImageProps {
  mod: Mod
  alt: string
  className?: string
  style?: React.CSSProperties
}

function ModImage({ mod, alt, className, style }: ModImageProps) {
  const [src, setSrc] = useState(() => getImageUrl(mod.imageName))

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="148px"
      className={className}
      style={style}
      unoptimized
      onError={() => {
        // Try wiki thumbnail first, then placeholder
        if (mod.wikiaThumbnail && src !== mod.wikiaThumbnail) {
          setSrc(mod.wikiaThumbnail)
        } else {
          setSrc(getPlaceholderUrl())
        }
      }}
    />
  )
}

// =============================================================================
// COMPACT MOD CARD
// =============================================================================

interface CompactModCardProps {
  mod: Mod
  rarity: ModRarity
  rank: number
  isMaxRank: boolean
  disableAnimation?: boolean
  drainOverride?: number
  matchState?: "match" | "mismatch" | "neutral"
}

function CompactModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  disableAnimation = false,
  drainOverride,
  matchState = "neutral",
}: CompactModCardProps) {
  const maxRank = mod.fusionLimit ?? 0
  const drain = drainOverride ?? mod.baseDrain + rank

  return (
    <ModCardFrame rarity={rarity} variant="compact">
      {/* Drain & Polarity Badge */}
      <DrainBadge
        drain={drain}
        polarity={mod.polarity}
        rarity={rarity}
        matchState={matchState}
      />

      {/* Mod Image */}
      <div className="pointer-events-none absolute top-[4px] right-[3px] -bottom-4 left-[3px] z-10 overflow-hidden rounded-b-[5px]">
        <ModImage
          mod={mod}
          alt={mod.name}
          className="object-cover object-top"
          style={{
            filter: "grayscale(0.7) brightness(0.35)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundColor: getRarityColor(rarity),
            mixBlendMode: "hard-light",
          }}
        />
      </div>

      {/* Mod Name */}
      <span
        className="absolute top-[70%] left-1/2 z-30 line-clamp-2 w-[170px] -translate-x-1/2 -translate-y-1/2 text-center text-[16px] leading-tight font-normal"
        style={{
          fontFamily: "Roboto, sans-serif",
          color: getRarityColor(rarity),
          textShadow:
            "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 6px #000, 0 0 12px #000",
        }}
      >
        {mod.name}
      </span>

      {/* Rank Complete Line */}
      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute -bottom-[28px] left-1/2 z-25 w-[calc(100%-8px)] -translate-x-1/2"
          disableAnimation={disableAnimation}
        />
      )}

      {/* Rank Dots */}
      <RankDots rank={rank} maxRank={maxRank} variant="compact" />
    </ModCardFrame>
  )
}

// =============================================================================
// EXPANDED MOD CARD
// =============================================================================

interface ExpandedModCardProps extends CompactModCardProps {
  setCount?: number
}

function ExpandedModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  setCount = 0,
  drainOverride,
  matchState = "neutral",
}: ExpandedModCardProps) {
  const stats = getModStats(mod, rank, setCount)
  const maxRank = mod.fusionLimit ?? 0
  const drain = drainOverride ?? mod.baseDrain + rank
  const compatLabel =
    mod.compatName ||
    (mod.type ? mod.type.replace(" Mod", "").toUpperCase() : "")

  const formattedStats = stats
    .map((s) => s.replace(/\\n/g, "<br/>"))
    .join("<br/>")

  // Set Bonus Logic
  const setStats = mod.modSetStats || []
  const maxSetSize = setStats.length
  const currentBonusIndex = Math.min(Math.max(0, setCount - 1), maxSetSize - 1)
  const currentBonus =
    setStats.length > 0
      ? setStats[currentBonusIndex].replace(/\\n/g, "<br/>")
      : null
  const showMax = maxSetSize > 1 && setCount < maxSetSize
  const maxBonus =
    setStats.length > 0
      ? setStats[maxSetSize - 1].replace(/\\n/g, "<br/>")
      : null

  return (
    <ModCardFrame rarity={rarity} variant="expanded">
      {/* Drain & Polarity Badge */}
      <DrainBadge
        drain={drain}
        polarity={mod.polarity}
        rarity={rarity}
        matchState={matchState}
      />

      {/* Mod Image - full card height */}
      <div className="absolute top-[4px] right-[3px] bottom-[4px] left-[3px] z-10 overflow-hidden">
        <ModImage
          mod={mod}
          alt={mod.name}
          className="object-contain object-top"
        />
      </div>

      {/* Info Panel */}
      <div className="absolute right-[3px] bottom-[20px] left-[3px] z-15">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
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

        {/* Text Content */}
        <div className="relative z-20 flex flex-col items-center px-2 pt-1.5 pb-2">
          {/* Mod Name */}
          <span
            className="text-center text-[14px] leading-tight font-medium"
            style={{
              fontFamily: "Roboto, sans-serif",
              color: getRarityColor(rarity),
            }}
          >
            {mod.name}
          </span>

          {/* Stats */}
          {formattedStats && (
            <div className="mt-1 flex w-full flex-col items-center gap-1 px-1">
              <span
                className="text-center text-[12px] leading-snug font-normal text-gray-300"
                style={{ fontFamily: "Roboto, sans-serif" }}
                dangerouslySetInnerHTML={{ __html: formattedStats }}
              />

              {/* Set Bonuses */}
              {setStats.length > 0 && (
                <>
                  <Separator className="mt-2" />
                  <div className="flex w-full flex-col gap-1 pt-1">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[9px] font-bold tracking-wider text-gray-400 uppercase">
                        Set ({setCount || 0}/{maxSetSize})
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: maxSetSize }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "size-1 rounded-full border border-white/30",
                              i < setCount ? "bg-white" : "bg-transparent",
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Current Bonus */}
                    <div className="flex flex-col gap-0.5">
                      {setCount > 0 && setCount < maxSetSize && (
                        <span className="text-center text-[8px] text-gray-500 uppercase">
                          Current
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-center text-[9px] leading-tight",
                          setCount > 0 ? "text-gray-300" : "text-gray-500",
                        )}
                        dangerouslySetInnerHTML={{ __html: currentBonus! }}
                      />
                    </div>

                    {/* Max Bonus Preview */}
                    {showMax && maxBonus && (
                      <div className="mt-1 flex flex-col gap-0.5 opacity-60">
                        <span className="text-center text-[8px] text-gray-500 uppercase">
                          Max ({maxSetSize})
                        </span>
                        <span
                          className="text-center text-[9px] leading-tight text-gray-500"
                          dangerouslySetInnerHTML={{ __html: maxBonus }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Lower Tab */}
          <LowerTab label={compatLabel} rarity={rarity} className="mt-1" />
        </div>
      </div>

      {/* Rank Complete Line */}
      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute bottom-[3px] left-1/2 z-25 w-[calc(100%-8px)] -translate-x-1/2"
        />
      )}

      {/* Rank Dots */}
      <RankDots rank={rank} maxRank={maxRank} variant="expanded" />
    </ModCardFrame>
  )
}

// =============================================================================
// MAIN MOD CARD COMPONENT
// =============================================================================

function ModCardComponent({
  mod,
  rank: externalRank,
  onRankChange,
  isSelected,
  className,
  setCount = 0,
  disableHover = false,
  drainOverride,
  matchState = "neutral",
}: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [portalContainer] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null,
  )
  const [expandedPosition, setExpandedPosition] = useState({ x: 0, y: 0 })

  const maxRank = mod.fusionLimit ?? 0
  const [internalRank, setInternalRank] = useState(maxRank)
  const rarity = normalizeRarity(mod.rarity)

  const currentRank = externalRank ?? internalRank
  const isMaxRank = currentRank >= maxRank

  const handleRankChange = useCallback(
    (newRank: number) => {
      const clampedRank = Math.max(0, Math.min(newRank, maxRank))
      if (onRankChange) {
        onRankChange(clampedRank)
      } else {
        setInternalRank(clampedRank)
      }
    },
    [maxRank, onRankChange],
  )

  // Keyboard rank adjustment
  useEffect(() => {
    if (!isHovered || disableHover) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        handleRankChange(currentRank - 1)
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        handleRankChange(currentRank + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isHovered, disableHover, currentRank, handleRankChange])

  // Calculate position for expanded card
  const handleMouseEnter = useCallback(() => {
    if (disableHover || !cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    setExpandedPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
    setIsHovered(true)
  }, [disableHover])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  // Close on scroll
  useEffect(() => {
    if (!isHovered) return

    const handleScroll = () => setIsHovered(false)
    const scrollOpts: AddEventListenerOptions = { capture: true, passive: true }
    window.addEventListener("scroll", handleScroll, scrollOpts)
    return () => window.removeEventListener("scroll", handleScroll, scrollOpts)
  }, [isHovered])

  const effectiveHover = isHovered && !disableHover

  const compactSize = DISPLAY_SIZE.compact

  return (
    <div
      ref={cardRef}
      className={cn("relative", className)}
      style={{ width: compactSize.width, height: compactSize.height }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Compact card - always rendered for layout, stays as hover target */}
      <div
        className={cn(
          "transition-opacity duration-100",
          isSelected && "brightness-125",
          effectiveHover ? "opacity-0" : "opacity-100",
        )}
      >
        <CompactModCard
          mod={mod}
          rarity={rarity}
          rank={currentRank}
          isMaxRank={isMaxRank}
          drainOverride={drainOverride}
          matchState={matchState}
        />
      </div>

      {/* Expanded card - in portal */}
      {effectiveHover && portalContainer && (
        <>
          {createPortal(
            <div
              className="pointer-events-none fixed z-[9999]"
              style={{
                left: expandedPosition.x,
                top: expandedPosition.y,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                className="drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
                style={{
                  animation:
                    "mod-card-expand 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
                  transformOrigin: "center center",
                }}
              >
                <ExpandedModCard
                  mod={mod}
                  rarity={rarity}
                  rank={currentRank}
                  isMaxRank={isMaxRank}
                  setCount={setCount}
                  drainOverride={drainOverride}
                  matchState={matchState}
                />
              </div>
            </div>,
            portalContainer,
          )}
        </>
      )}
    </div>
  )
}

// =============================================================================
// DRAG GHOST COMPONENT
// =============================================================================

const RARITY_BORDER_MAP: Record<ModRarity, string> = {
  Common: "border-wf-rarity-common",
  Uncommon: "border-wf-rarity-uncommon",
  Rare: "border-wf-rarity-rare",
  Legendary: "border-wf-rarity-legendary",
  Peculiar: "border-wf-rarity-legendary",
  Riven: "border-wf-rarity-riven",
  Amalgam: "border-wf-rarity-amalgam",
  Galvanized: "border-wf-rarity-galvanized",
}

const RARITY_BG_MAP: Record<ModRarity, string> = {
  Common: "bg-wf-rarity-common-bg/90",
  Uncommon: "bg-wf-rarity-uncommon-bg/90",
  Rare: "bg-wf-rarity-rare-bg/90",
  Legendary: "bg-wf-rarity-legendary-bg/90",
  Peculiar: "bg-wf-rarity-legendary-bg/90",
  Riven: "bg-wf-rarity-riven-bg/90",
  Amalgam: "bg-wf-rarity-amalgam-bg/90",
  Galvanized: "bg-wf-rarity-galvanized-bg/90",
}

export interface DragGhostProps {
  mod: { name: string; rarity?: string }
  rarity?: string
}

export function DragGhost({ mod, rarity }: DragGhostProps) {
  const modRarity = normalizeRarity(rarity || mod.rarity || "Common")

  return (
    <div
      className={cn(
        "flex h-[64px] w-[184px] items-center justify-center rounded-lg border-2 px-3",
        "cursor-grabbing shadow-xl backdrop-blur-sm",
        RARITY_BORDER_MAP[modRarity],
        RARITY_BG_MAP[modRarity],
      )}
    >
      <span
        className="truncate text-center text-sm font-medium"
        style={{ color: getRarityColor(modRarity) }}
      >
        {mod.name}
      </span>
    </div>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export const ModCard = memo(ModCardComponent)
export { CompactModCard }
export type { ModRarity }
