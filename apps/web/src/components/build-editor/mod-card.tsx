import type { Mod } from "@arsenyx/shared/warframe/types"
import { Fragment, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import {
  DISPLAY_SIZE,
  type ModRarity,
  getModAssetUrl,
  getRarityColor,
  normalizeRarity,
} from "@/lib/mod-card-config"
import { cn } from "@/lib/utils"
import { getImageUrl } from "@/lib/warframe"

import {
  DrainBadge,
  type DrainMatchState,
  LowerTab,
  ModCardFrame,
  RankCompleteLine,
  RankDots,
} from "./mod-card-frame"

const NUMBER_PATTERN = /(\d+(\.\d+)?)/g

// Stats where a "positive" riven roll is semantically a debuff — we invert the
// displayed sign so the number reads the way the in-game arsenal shows it.
const INVERTED_RIVEN_STATS = new Set(["Zoom"])

function formatRivenValue(stat: string, v: number): string {
  const display = INVERTED_RIVEN_STATS.has(stat) ? -v : v
  const fixed = display.toFixed(1)
  const stripped = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed
  const sign = display > 0 ? "+" : ""
  return `${sign}${stripped}%`
}

type StatLine =
  | { kind: "plain"; text: string }
  | {
      kind: "riven"
      sign: "positive" | "negative"
      value: string
      stat: string
    }

function getModStats(mod: Mod, rank: number, setCount: number = 0): StatLine[] {
  if (mod.rivenStats) {
    const out: StatLine[] = []
    for (const p of mod.rivenStats.positives ?? []) {
      out.push({
        kind: "riven",
        sign: "positive",
        value: formatRivenValue(p.stat, p.value),
        stat: p.stat,
      })
    }
    for (const n of mod.rivenStats.negatives ?? []) {
      out.push({
        kind: "riven",
        sign: "negative",
        value: formatRivenValue(n.stat, n.value),
        stat: n.stat,
      })
    }
    return out
  }
  if (!mod.levelStats || mod.levelStats.length === 0) return []
  const levelIndex = Math.min(rank, mod.levelStats.length - 1)
  const baseStats = mod.levelStats[levelIndex]?.stats ?? []

  if (
    mod.modSet === "/Lotus/Upgrades/Mods/Sets/Umbra/UmbraSetMod" &&
    setCount > 1
  ) {
    const isIntensify = mod.name.includes("Intensify")
    let multiplier = 1.0
    if (setCount === 2) multiplier = isIntensify ? 1.25 : 1.3
    else if (setCount >= 3) multiplier = isIntensify ? 1.75 : 1.8
    return baseStats.map((stat) => ({
      kind: "plain" as const,
      text: stat.replace(NUMBER_PATTERN, (match) => {
        const value = parseFloat(match)
        return parseFloat((value * multiplier).toFixed(1)).toString()
      }),
    }))
  }

  return baseStats.map((s) => ({ kind: "plain" as const, text: s }))
}

// Game data embeds inline tokens like <DT_ELECTRICITY_COLOR>, <LINE_SEPARATOR>,
// <ENERGY>, etc. that the in-game UI uses for coloring/icons. We render plain
// text, so normalize: <LINE_SEPARATOR> becomes a literal "\n" split point,
// every other <…> token is stripped. The previous innerHTML path silently
// dropped these as unknown custom elements; React would otherwise render them
// as visible text.
const INLINE_TAG_PATTERN = /<[A-Z_][A-Z0-9_]*>/g

function stripInlineTags(text: string): string {
  return text
    .replace(/<LINE_SEPARATOR>/g, "\\n")
    .replace(INLINE_TAG_PATTERN, "")
}

function StatLineView({ line }: { line: StatLine }) {
  if (line.kind === "riven") {
    const color = line.sign === "positive" ? "text-green-400" : "text-red-400"
    return (
      <span>
        <span className={color}>{line.value}</span> {line.stat}
      </span>
    )
  }
  // Game data stores literal "\n" (backslash-n) in stat strings, not real
  // newlines — split on the escape sequence to render multi-line entries.
  const parts = stripInlineTags(line.text).split(/\\n/g)
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {part}
        </Fragment>
      ))}
    </>
  )
}

interface CompactProps {
  mod: Mod
  rarity: ModRarity
  rank: number
  isMaxRank: boolean
  drainOverride?: number
  matchState?: DrainMatchState
  vtPrefix?: string
}

function CompactModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  drainOverride,
  matchState = "neutral",
  vtPrefix,
}: CompactProps) {
  const maxRank = mod.fusionLimit ?? 0
  const drain =
    drainOverride ??
    (mod.rivenStats ? (mod.baseDrain ?? 0) : (mod.baseDrain ?? 0) + rank)

  return (
    <ModCardFrame rarity={rarity} variant="compact" vtPrefix={vtPrefix}>
      <DrainBadge
        drain={drain}
        polarity={mod.polarity}
        rarity={rarity}
        matchState={matchState}
        vtPrefix={vtPrefix}
      />

      <div
        className="pointer-events-none absolute top-[4px] right-[3px] -bottom-4 left-[3px] z-10 overflow-hidden rounded-b-[5px]"
        style={
          vtPrefix
            ? ({ viewTransitionName: `${vtPrefix}-art` } as React.CSSProperties)
            : undefined
        }
      >
        <img
          src={getImageUrl(mod.imageName)}
          alt=""
          className="h-full w-full object-cover object-top"
          style={{ filter: "grayscale(0.7) brightness(0.35)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundColor: getRarityColor(rarity),
            mixBlendMode: "hard-light",
          }}
        />
      </div>

      <span
        className="absolute top-[70%] left-1/2 z-30 line-clamp-2 w-[170px] -translate-x-1/2 -translate-y-1/2 text-center text-[16px] leading-tight font-normal"
        style={{
          fontFamily: "Roboto, sans-serif",
          color: getRarityColor(rarity),
          textShadow:
            "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 6px #000, 0 0 12px #000",
          ...(vtPrefix ? { viewTransitionName: `${vtPrefix}-name` } : {}),
        }}
      >
        {mod.name}
      </span>

      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute -bottom-[28px] left-1/2 z-25 w-[calc(100%-8px)] -translate-x-1/2"
        />
      )}

      <RankDots
        rank={rank}
        maxRank={maxRank}
        variant="compact"
        vtPrefix={vtPrefix}
      />
    </ModCardFrame>
  )
}

interface ExpandedProps extends CompactProps {
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
  vtPrefix,
}: ExpandedProps) {
  const stats = getModStats(mod, rank, setCount)
  const maxRank = mod.fusionLimit ?? 0
  const drain =
    drainOverride ??
    (mod.rivenStats ? (mod.baseDrain ?? 0) : (mod.baseDrain ?? 0) + rank)
  const compatLabel =
    mod.compatName ||
    (mod.type ? mod.type.replace(" Mod", "").toUpperCase() : "")

  const hasStats = stats.length > 0

  return (
    <ModCardFrame rarity={rarity} variant="expanded" vtPrefix={vtPrefix}>
      <DrainBadge
        drain={drain}
        polarity={mod.polarity}
        rarity={rarity}
        matchState={matchState}
        vtPrefix={vtPrefix}
      />

      <div
        className="absolute top-[4px] right-[3px] bottom-[4px] left-[3px] z-10 overflow-hidden"
        style={
          vtPrefix
            ? ({ viewTransitionName: `${vtPrefix}-art` } as React.CSSProperties)
            : undefined
        }
      >
        <img
          src={getImageUrl(mod.imageName)}
          alt=""
          className="h-full w-full object-contain object-top"
        />
      </div>

      <div className="absolute right-[3px] bottom-[20px] left-[3px] z-[15]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={getModAssetUrl(rarity, "Background")}
            alt=""
            className="h-full w-full object-cover object-bottom"
          />
        </div>
        <div className="relative z-20 flex flex-col items-center px-2 pt-1.5 pb-2">
          <span
            className="text-center text-[14px] leading-tight font-medium"
            style={{
              fontFamily: "Roboto, sans-serif",
              color: getRarityColor(rarity),
              ...(vtPrefix ? { viewTransitionName: `${vtPrefix}-name` } : {}),
            }}
          >
            {mod.name}
          </span>

          {hasStats && (
            <div className="mt-1 flex w-full flex-col items-center gap-1 px-1">
              <span
                className="text-center text-[12px] leading-snug font-normal text-gray-300"
                style={{ fontFamily: "Roboto, sans-serif" }}
              >
                {stats.map((line, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    <StatLineView line={line} />
                  </Fragment>
                ))}
              </span>
            </div>
          )}

          <LowerTab label={compatLabel} rarity={rarity} className="mt-1" />
        </div>
      </div>

      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute bottom-[4px] left-1/2 z-25 w-[calc(100%-8px)] -translate-x-1/2"
        />
      )}

      <RankDots
        rank={rank}
        maxRank={maxRank}
        variant="expanded"
        vtPrefix={vtPrefix}
      />
    </ModCardFrame>
  )
}

export interface ModCardProps {
  mod: Mod
  /** Leave undefined to default to the mod's max rank. */
  rank?: number
  setCount?: number
  drainOverride?: number
  matchState?: DrainMatchState
  /** When true, always show the expanded variant (no hover behavior). */
  alwaysExpanded?: boolean
  /** When true, never show the expanded variant (used while dragging). */
  disableHover?: boolean
  onClick?: () => void
  isSelected?: boolean
  className?: string
}

// Rank dots hang ~32px below the 64px compact frame; extend the hover surface
// so cursor motion across the dots doesn't trigger mouseleave.
const HOVER_OVERHANG = 32

export function ModCard({
  mod,
  rank,
  setCount = 0,
  drainOverride,
  matchState,
  alwaysExpanded = false,
  disableHover = false,
  onClick,
  isSelected,
  className,
}: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const hoverCenter = useRef<{ x: number; y: number } | null>(null)
  const compactRef = useRef<HTMLDivElement>(null)
  const rarity = normalizeRarity(mod.rarity)
  const maxRank = mod.fusionLimit ?? 0
  // Default to max rank so preview cards read the way equipped mods look
  // in-game. Callers that need a specific rank (placed slots) pass one.
  const effectiveRank = rank ?? maxRank
  const isMaxRank = maxRank > 0 && effectiveRank >= maxRank
  const effectiveHover = isHovered && !disableHover

  // Scroll collapses the preview — otherwise the card can stay stuck open
  // if its wrapper moves out from under the cursor silently.
  useEffect(() => {
    if (!isHovered) return
    const close = () => setIsHovered(false)
    window.addEventListener("scroll", close, { capture: true, passive: true })
    return () => window.removeEventListener("scroll", close, { capture: true })
  }, [isHovered])

  // alwaysExpanded skips all the hover machinery.
  if (alwaysExpanded) {
    return (
      <div
        className={cn(
          "relative",
          onClick && "cursor-pointer",
          isSelected && "brightness-125",
          className,
        )}
        style={{
          width: DISPLAY_SIZE.expanded.width,
          height: DISPLAY_SIZE.expanded.height,
        }}
        onClick={onClick}
      >
        <ExpandedModCard
          mod={mod}
          rarity={rarity}
          rank={effectiveRank}
          isMaxRank={isMaxRank}
          setCount={setCount}
          drainOverride={drainOverride}
          matchState={matchState}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative",
        onClick && "cursor-pointer",
        isSelected && "brightness-125",
        className,
      )}
      style={{
        width: DISPLAY_SIZE.compact.width,
        height: DISPLAY_SIZE.compact.height + HOVER_OVERHANG,
      }}
      onMouseEnter={() => {
        const r = compactRef.current?.getBoundingClientRect()
        if (r) {
          // Use rect's own width/height (not DISPLAY_SIZE constants) so the
          // center is correct under any ancestor `transform: scale()` —
          // getBoundingClientRect already returns visual/transformed coords,
          // so adding the unscaled width would overshoot.
          hoverCenter.current = {
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          }
        }
        setIsHovered(true)
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Compact — always mounted, fades on hover so it crossfades into
          the expanded card. */}
      <div
        ref={compactRef}
        className="absolute top-0 left-0 transition-opacity duration-100 ease-out"
        style={{
          width: DISPLAY_SIZE.compact.width,
          height: DISPLAY_SIZE.compact.height,
          opacity: effectiveHover ? 0 : 1,
        }}
      >
        <CompactModCard
          mod={mod}
          rarity={rarity}
          rank={effectiveRank}
          isMaxRank={isMaxRank}
          drainOverride={drainOverride}
          matchState={matchState}
        />
      </div>

      {/* Expanded — portaled to <body> so it escapes the horizontal-scroll
          parent's clipping. Positioned with `fixed` at the compact card's
          viewport-center; scroll listener closes hover so stale coords
          don't matter. 150ms scale-in keyframe matches legacy's behavior. */}
      {effectiveHover &&
        hoverCenter.current &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50"
            style={{
              top: hoverCenter.current.y,
              left: hoverCenter.current.x,
              width: DISPLAY_SIZE.expanded.width,
              height: DISPLAY_SIZE.expanded.height,
              transform: "translate(-50%, -50%)",
              transformOrigin: "center center",
              animation:
                "mod-card-expand 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
              filter: "drop-shadow(0 0 20px rgba(0,0,0,0.8))",
            }}
          >
            <ExpandedModCard
              mod={mod}
              rarity={rarity}
              rank={effectiveRank}
              isMaxRank={isMaxRank}
              setCount={setCount}
              drainOverride={drainOverride}
              matchState={matchState}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
