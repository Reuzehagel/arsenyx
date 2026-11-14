import type { AlternateMod } from "@arsenyx/shared/warframe/build-data"
import { getModSetCode } from "@arsenyx/shared/warframe/mods"
import { RIVEN_FLAT_STAT_UNITS } from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { StatText } from "@/components/stat-text"
import { baseDrainForMod } from "@/lib/build/calculations"
import { modSlotKind } from "@/lib/build/slot-kind"
import { modMaxRank } from "@/lib/build/slot-ranks"
import { getImageUrl } from "@/lib/image-url"
import {
  DISPLAY_SIZE,
  type ModRarity,
  type SlotBadgeKind,
  getModAssetUrl,
  getRarityColor,
  getSetIconUrl,
  normalizeRarity,
} from "@/lib/mod-card-config"
import { umbralSetMultiplier } from "@/lib/stats/warframe"
import { formatStat } from "@/lib/util/format"
import { cn } from "@/lib/util/utils"

import {
  DrainBadge,
  type DrainMatchState,
  LowerTab,
  ModCardFrame,
  ModSlotBadge,
  RankCompleteLine,
  RankDots,
} from "./mod-card-frame"

/** Top-center badges: the slot glyph and the set crest are independent —
 * several set mods are also exilus-compatible, and in-game both show. */
function resolveBadge(
  mod: Mod,
  rarity: ModRarity,
): {
  slotKind: SlotBadgeKind | null
  setIconUrl: string | null
} {
  const kind = modSlotKind(mod)
  return {
    slotKind: kind === "normal" ? null : kind,
    setIconUrl: getSetIconUrl(getModSetCode(mod), rarity),
  }
}

const NUMBER_PATTERN = /(\d+(\.\d+)?)/g

// Frame PNGs (FrameTop/Bottom + the expanded-only Background/LowerTab) get
// fetched cold the first time a card of a given rarity renders, which shows
// up as a visible "frame pops in" delay. Warm them up the moment any card
// mounts, regardless of rarity — the user is in the editor, so all eight
// rarity sets are likely to appear within seconds.
const ALL_RARITIES: ModRarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Legendary",
  "Peculiar",
  "Riven",
  "Amalgam",
  "Galvanized",
]

const FRAME_ASSETS = [
  "FrameTop",
  "FrameBottom",
  "Background",
  "LowerTab",
  "TopRightBacker",
] as const

let allRaritiesPreloaded = false

function preloadAllRarityFrames() {
  if (allRaritiesPreloaded) return
  allRaritiesPreloaded = true
  for (const rarity of ALL_RARITIES) {
    for (const asset of FRAME_ASSETS) {
      const img = new Image()
      img.src = getModAssetUrl(rarity, asset)
    }
  }
}

// Stats where a "positive" riven roll is semantically a debuff — we invert the
// displayed sign so the number reads the way the in-game arsenal shows it.
const INVERTED_RIVEN_STATS = new Set(["Zoom"])

function formatRivenValue(stat: string, v: number): string {
  const display = INVERTED_RIVEN_STATS.has(stat) ? -v : v
  const sign = display > 0 ? "+" : ""
  const unit = RIVEN_FLAT_STAT_UNITS[stat] ?? "%"
  return `${sign}${formatStat(display, 1)}${unit}`
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
    const multiplier = umbralSetMultiplier(mod.name, setCount)
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

function StatLineView({ line }: { line: StatLine }) {
  if (line.kind === "riven") {
    const color = line.sign === "positive" ? "text-green-400" : "text-red-400"
    return (
      <span>
        <span className={color}>{line.value}</span> {line.stat}
      </span>
    )
  }
  // StatText handles <LINE_SEPARATOR>, literal "\n", and <DT_*_COLOR>
  // damage-type spans (with inline element icons).
  return <StatText text={line.text} />
}

interface CompactProps {
  mod: Mod
  rarity: ModRarity
  rank: number
  isMaxRank: boolean
  drainOverride?: number
  matchState?: DrainMatchState
  /** Suppress the drain badge entirely — used by Plexus Battle/Tactical
   * slots, which don't draw from the capacity pool so the number is
   * meaningless on those cards. */
  hideDrain?: boolean
  vtPrefix?: string
}

/** Tektolyst Artifact (Antique) mods take no capacity and ship DE's
 *  catch-all compatName "ANY" (wiki.warframe.com/w/Antique_Mods). */
function isAntiqueMod(mod: Mod): boolean {
  return mod.uniqueName.includes("/Mods/Antiques/")
}

function CompactModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  drainOverride,
  matchState = "neutral",
  hideDrain = false,
  vtPrefix,
}: CompactProps) {
  const maxRank = modMaxRank(mod)
  const drain = drainOverride ?? baseDrainForMod(mod, rank)

  useEffect(() => {
    preloadAllRarityFrames()
  }, [])

  const badge = resolveBadge(mod, rarity)

  return (
    <ModCardFrame rarity={rarity} variant="compact" vtPrefix={vtPrefix}>
      {!hideDrain && (
        <DrainBadge
          drain={drain}
          polarity={mod.polarity}
          rarity={rarity}
          matchState={matchState}
          vtPrefix={vtPrefix}
        />
      )}
      <ModSlotBadge
        slotKind={badge.slotKind}
        setIconUrl={badge.setIconUrl}
        rarity={rarity}
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
          reveal
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
  hideDrain = false,
  vtPrefix,
}: ExpandedProps) {
  const stats = getModStats(mod, rank, setCount)
  // Set bonus (DE ExportModSet, one tier per equipped set member — tier
  // count == set size for every set). With n set mods equipped show the
  // active tier; with none (mod picker, browse) preview the max tier.
  // modSetStats is ordered ascending (tier 1 = one member … tier N = full set).
  // With n members equipped show tier n (capped at the set size); with none
  // equipped — the picker/browse preview — show the full-set max tier.
  const setSize = mod.modSetStats?.length ?? 0
  const setTier = setCount > 0 ? Math.min(setCount, setSize) : setSize
  const setBonus = setSize > 0 ? mod.modSetStats?.[setTier - 1] : undefined
  const maxRank = modMaxRank(mod)
  const drain = drainOverride ?? baseDrainForMod(mod, rank)
  const compatLabel = isAntiqueMod(mod)
    ? "ANTIQUE"
    : mod.compatName ||
      (mod.type ? mod.type.replace(" Mod", "").toUpperCase() : "")

  const hasStats = stats.length > 0

  const badge = resolveBadge(mod, rarity)

  return (
    <ModCardFrame rarity={rarity} variant="expanded" vtPrefix={vtPrefix}>
      {!hideDrain && (
        <DrainBadge
          drain={drain}
          polarity={mod.polarity}
          rarity={rarity}
          matchState={matchState}
          vtPrefix={vtPrefix}
        />
      )}
      <ModSlotBadge
        slotKind={badge.slotKind}
        setIconUrl={badge.setIconUrl}
        rarity={rarity}
      />

      <div
        className="unfold-top unfold-art absolute top-[4px] right-[3px] bottom-[4px] left-[3px] z-10 overflow-hidden"
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

      <div className="unfold-bottom unfold-panel absolute right-[3px] bottom-[20px] left-[3px] z-[15]">
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

          {setBonus && (
            <div className="mt-1 w-full px-1 text-center">
              <span
                className="text-[10px] font-medium tracking-wide text-gray-400 uppercase"
                style={{ fontFamily: "Roboto, sans-serif" }}
              >
                Set Bonus{setCount > 0 ? ` (${setCount}/${setSize})` : ""}
              </span>
              <div
                className="text-[11px] leading-snug font-normal text-gray-300"
                style={{ fontFamily: "Roboto, sans-serif" }}
              >
                <StatText text={setBonus} />
              </div>
            </div>
          )}

          <LowerTab label={compatLabel} rarity={rarity} className="mt-1" />
        </div>
      </div>

      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="unfold-bottom absolute bottom-[4px] left-1/2 z-25 w-[calc(100%-8px)] -translate-x-1/2"
        />
      )}

      <RankDots
        className="unfold-bottom"
        rank={rank}
        maxRank={maxRank}
        variant="expanded"
        vtPrefix={vtPrefix}
      />
    </ModCardFrame>
  )
}

interface ModCardProps {
  mod: Mod
  /** Leave undefined to default to the mod's max rank. */
  rank?: number
  setCount?: number
  drainOverride?: number
  matchState?: DrainMatchState
  /** Suppress the drain badge — Plexus Battle/Tactical slots don't draw
   * from the capacity pool so the drain number reads as noise. */
  hideDrain?: boolean
  /** When true, always show the expanded variant (no hover behavior). */
  alwaysExpanded?: boolean
  /** When true, never show the expanded variant (used while dragging). */
  disableHover?: boolean
  /** The slot's Alternate, shown expanded beside this card's expanded form so
   * the two can be compared (it otherwise only peeks out behind the slot). */
  alternate?: CardAlternate
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
  hideDrain = false,
  alwaysExpanded = false,
  disableHover = false,
  alternate,
  onClick,
  isSelected,
  className,
}: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const hoverCenter = useRef<{ x: number; y: number } | null>(null)
  const compactRef = useRef<HTMLDivElement>(null)
  const rarity = normalizeRarity(mod.rarity)
  const maxRank = modMaxRank(mod)
  // Default to max rank so preview cards read the way equipped mods look
  // in-game. Callers that need a specific rank (placed slots) pass one.
  const effectiveRank = rank ?? maxRank
  const isMaxRank = maxRank > 0 && effectiveRank >= maxRank
  const effectiveHover = isHovered && !disableHover
  const noDrain = hideDrain || isAntiqueMod(mod)

  // Scroll collapses the preview — otherwise the card can stay stuck open
  // if its wrapper moves out from under the cursor silently. Same problem
  // happens when the grid reflows (e.g. mod search filters): the DOM node
  // shifts but no mouseleave fires, so we also re-check on pointermove.
  useEffect(() => {
    if (!isHovered) return
    const close = () => setIsHovered(false)
    const checkPointer = (e: PointerEvent) => {
      const r = compactRef.current?.getBoundingClientRect()
      if (!r) return
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom + HOVER_OVERHANG
      ) {
        setIsHovered(false)
      }
    }
    window.addEventListener("scroll", close, { capture: true, passive: true })
    window.addEventListener("pointermove", checkPointer, { passive: true })
    return () => {
      window.removeEventListener("scroll", close, { capture: true })
      window.removeEventListener("pointermove", checkPointer)
    }
  }, [isHovered])

  // Close when the card's layout shifts (e.g. mod search filters reorder
  // the grid) — pointermove alone doesn't fire if the user types without
  // moving the cursor.
  const lastHoveredRect = useRef<DOMRect | null>(null)
  // No dep array on purpose: this must re-measure after every render to catch
  // grid reorders that don't change isHovered. setIsHovered(false) fires only
  // on a large shift, and the !isHovered guard below early-returns next run, so
  // there's no update loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!isHovered) {
      lastHoveredRect.current = null
      return
    }
    const r = compactRef.current?.getBoundingClientRect()
    if (!r) return
    const prev = lastHoveredRect.current
    // Threshold of half a card width — only a genuine grid reorder will
    // ever shift by this much. Smaller wobbles from scrollbar gutters,
    // sibling state changes, or font-load reflow shouldn't dismiss hover.
    const shiftThreshold = DISPLAY_SIZE.compact.width / 2
    if (
      prev &&
      (Math.abs(prev.left - r.left) > shiftThreshold ||
        Math.abs(prev.top - r.top) > shiftThreshold)
    ) {
      setIsHovered(false)
      return
    }
    lastHoveredRect.current = r
  })

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
          hideDrain={noDrain}
        />
        {alternate && <AlternateCompanion alternate={alternate} />}
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
          the expanded card. Tagged so the view-mode click-to-pin (mod-slot.tsx)
          can measure the exact same anchor the hover preview centers on,
          keeping the pinned card pixel-aligned with the hover card. */}
      <div
        ref={compactRef}
        data-mod-compact
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
          hideDrain={noDrain}
        />
      </div>

      {/* Expanded — portaled to <body> so it escapes the horizontal-scroll
          parent's clipping. Positioned with `fixed` at the compact card's
          viewport-center; scroll listener closes hover so stale coords
          don't matter. Unfolds via `.animate-mod-card-expand` (globals.css). */}
      {effectiveHover &&
        hoverCenter.current &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="animate-mod-card-expand pointer-events-none fixed z-50"
            style={{
              top: hoverCenter.current.y,
              left: hoverCenter.current.x,
              width: DISPLAY_SIZE.expanded.width,
              height: DISPLAY_SIZE.expanded.height,
              transform: "translate(-50%, -50%)",
              transformOrigin: "center center",
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
            {alternate && <AlternateCompanion alternate={alternate} />}
          </div>,
          document.body,
        )}
    </div>
  )
}

/** An Alternate plus how it would read in this card's slot (forma'd drain). */
export type CardAlternate = AlternateMod & {
  drainOverride?: number
  matchState?: DrainMatchState
  hideDrain?: boolean
}

const COMPANION_GAP = 12

/** Which side of an expanded card centred at `centerX` (drawn at `scale`) has
 * room for its Alternate, or null when neither does (phones). */
export function alternateSide(
  centerX: number,
  scale = 1,
): "right" | "left" | null {
  const half = (DISPLAY_SIZE.expanded.width / 2) * scale
  const need = (COMPANION_GAP + DISPLAY_SIZE.expanded.width) * scale
  // 1px slack: a pair scaled to fit exactly must not round itself out.
  if (centerX + half + need <= window.innerWidth + 1) return "right"
  if (centerX - half - need >= -1) return "left"
  return null
}

/** Scale and centre for a pinned card plus its Alternate on a screen too
 * narrow to fit them beside the slot: the pair shrinks to fit and is centred,
 * so the Alternate lands on the right. */
export function fitPairOnScreen(margin = 16) {
  const pair = 2 * DISPLAY_SIZE.expanded.width + COMPANION_GAP
  const scale = Math.min(1, (window.innerWidth - 2 * margin) / pair)
  const centerX =
    window.innerWidth / 2 -
    ((COMPANION_GAP + DISPLAY_SIZE.expanded.width) * scale) / 2
  return { scale, centerX }
}

/**
 * The slot's Alternate, expanded beside the main mod's expanded card (hover
 * preview or pinned detail) under an "Alternate" label: to the right, or to
 * the left when the right would leave the viewport. Inside the hover preview
 * it unfolds with it, a beat later.
 */
function AlternateCompanion({ alternate }: { alternate: CardAlternate }) {
  const ref = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState<"right" | "left">("right")
  useLayoutEffect(() => {
    const anchor = ref.current?.parentElement?.getBoundingClientRect()
    if (!anchor) return
    const scale = anchor.width / DISPLAY_SIZE.expanded.width
    setSide(alternateSide(anchor.left + anchor.width / 2, scale) ?? "right")
  }, [])
  const gap = `calc(100% + ${COMPANION_GAP}px)`
  return (
    <div
      ref={ref}
      data-alt-companion
      className="absolute"
      style={side === "right" ? { top: 0, left: gap } : { top: 0, right: gap }}
    >
      <span className="unfold-top text-muted-foreground absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-wide uppercase">
        Alternate
      </span>
      <ModCard
        mod={alternate.mod}
        rank={alternate.rank}
        drainOverride={alternate.drainOverride}
        matchState={alternate.matchState}
        hideDrain={alternate.hideDrain}
        alwaysExpanded
      />
    </div>
  )
}
