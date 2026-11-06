import type { Polarity } from "@arsenyx/shared/warframe/types"

import {
  type CardVariant,
  DISPLAY_SIZE,
  type ModRarity,
  type SlotBadgeKind,
  getModAssetUrl,
  getPolarityIconUrl,
  getRarityColor,
  getSlotBadgeUrl,
} from "@/lib/mod-card-config"
import { cn } from "@/lib/util/utils"

/**
 * Layered PNG frame composition for a mod card. Wraps children between top
 * and bottom rarity frames, with an optional background for expanded mode.
 */
export function ModCardFrame({
  rarity,
  variant,
  children,
  className,
  vtPrefix,
}: {
  rarity: ModRarity
  variant: CardVariant
  children?: React.ReactNode
  className?: string
  /** Per-card id. Enables View Transitions to morph matching layers between
   *  compact and expanded subtrees. Omit if you don't want VT on this card. */
  vtPrefix?: string
}) {
  const size = DISPLAY_SIZE[variant]
  const isExpanded = variant === "expanded"
  const isOversizedTop =
    rarity === "Amalgam" || rarity === "Galvanized" || rarity === "Riven"

  return (
    <div
      className={cn("relative select-none", className)}
      style={{
        width: size.width,
        height: size.height,
        isolation: "isolate",
      }}
    >
      {isExpanded && (
        <div className="absolute inset-x-[3px] top-[4px] bottom-[4px] z-[5] overflow-hidden rounded-b-[20px]">
          <img
            src={getModAssetUrl(rarity, "Background")}
            alt=""
            className="h-full w-full object-cover object-bottom"
          />
        </div>
      )}

      <img
        src={getModAssetUrl(rarity, "FrameTop")}
        alt=""
        className={cn(
          "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2",
          isOversizedTop ? "-top-2 h-auto w-[110%] max-w-none" : "top-0 w-full",
        )}
        style={
          vtPrefix
            ? ({
                viewTransitionName: `${vtPrefix}-frame-top`,
              } as React.CSSProperties)
            : undefined
        }
      />

      {children}

      <img
        src={getModAssetUrl(rarity, "FrameBottom")}
        alt=""
        className={cn(
          "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2",
          isExpanded ? "bottom-0" : "-bottom-8",
          isOversizedTop ? "h-auto w-[110%] max-w-none" : "w-full",
        )}
        style={
          vtPrefix
            ? ({
                viewTransitionName: `${vtPrefix}-frame-bottom`,
              } as React.CSSProperties)
            : undefined
        }
      />
    </div>
  )
}

export function RankDots({
  rank,
  maxRank,
  variant,
  className,
  vtPrefix,
}: {
  rank: number
  maxRank: number
  variant: CardVariant
  className?: string
  vtPrefix?: string
}) {
  if (maxRank === 0) return null
  const position =
    variant === "compact"
      ? "absolute -bottom-[27px] left-1/2 -translate-x-1/2"
      : "absolute bottom-[4px] left-1/2 -translate-x-1/2"

  return (
    <div
      className={cn(
        position,
        "pointer-events-none z-30 flex gap-0.5",
        className,
      )}
      style={
        vtPrefix
          ? ({ viewTransitionName: `${vtPrefix}-dots` } as React.CSSProperties)
          : undefined
      }
    >
      {Array.from({ length: maxRank }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-[5px] w-[5px] rounded-full",
            i < rank ? "bg-sky-300" : "bg-zinc-600/60",
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

export function RankCompleteLine({
  rarity,
  className,
}: {
  rarity: ModRarity
  className?: string
}) {
  return (
    <div className={cn("pointer-events-none overflow-hidden", className)}>
      <img
        src={getModAssetUrl(rarity, "RankCompleteLine")}
        alt=""
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
    </div>
  )
}

export type DrainMatchState = "match" | "mismatch" | "neutral"

export function DrainBadge({
  drain,
  polarity,
  rarity,
  matchState = "neutral",
  vtPrefix,
}: {
  drain: number
  polarity: Polarity
  rarity: ModRarity
  matchState?: DrainMatchState
  vtPrefix?: string
}) {
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

  return (
    <div
      className="absolute top-[7px] right-[2px] z-30 flex items-center justify-center"
      style={
        vtPrefix
          ? ({ viewTransitionName: `${vtPrefix}-badge` } as React.CSSProperties)
          : undefined
      }
    >
      <img
        src={getModAssetUrl(rarity, "TopRightBacker")}
        alt=""
        width={36}
        height={18}
        className="pointer-events-none"
      />
      <div className="absolute inset-0 flex items-center justify-center gap-[1px] pt-[0.5px] pl-[3px]">
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
        <div
          className="relative h-[13px] w-[13px]"
          style={{
            backgroundColor: badgeColor,
            maskImage: `url(${getPolarityIconUrl(polarity)})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: `url(${getPolarityIconUrl(polarity)})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
      </div>
    </div>
  )
}

/**
 * Top-center badges marking a mod's slot type (Aura/Exilus/Stance) and/or
 * set membership. Both stack when both apply — the slot glyph sits inside
 * the frame top while the set crest overlaps it above — mirroring the
 * in-game / Overframe convention (see issue #112).
 *
 * Slot icons use `mask-image` so the source PNG color is discarded — we
 * tint to the mod's rarity color. Set crest PNGs are pre-tinted offline
 * by `scripts/tint-set-crests.py`, so they render as a plain `<img>`.
 */
export function ModSlotBadge({
  slotKind,
  setIconUrl,
  rarity,
}: {
  slotKind: SlotBadgeKind | null
  setIconUrl: string | null
  rarity: ModRarity
}) {
  if (!slotKind && !setIconUrl) return null
  // Sizes intentionally don't depend on the parent card's compact/expanded
  // variant: the frame top is the same physical size in both, and scaling
  // the badge on hover would make it jump, which reads as broken.
  const slotSize = 20
  // setSize:slotSize ≈ 4.2:1 — slightly larger than the in-game ornament:glyph
  // ratio (3.4:1) for a more prominent crest read at card sizes.
  const setSize = 84

  return (
    <>
      {slotKind && (
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
          style={{ top: 7, width: slotSize, height: slotSize }}
          aria-hidden
        >
          <div
            className="h-full w-full"
            style={{
              backgroundColor: getRarityColor(rarity),
              maskImage: `url(${getSlotBadgeUrl(slotKind)})`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskImage: `url(${getSlotBadgeUrl(slotKind)})`,
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              filter: "drop-shadow(0 0 2px rgba(0,0,0,0.9))",
            }}
          />
        </div>
      )}
      {setIconUrl && (
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
          style={{ top: -32, width: setSize, height: setSize }}
          aria-hidden
        >
          <img
            // `key` forces a fresh DOM node when the URL changes. Without it
            // React reuses the <img> across mod swaps, and a prior failed
            // load's `display: none` could leak onto a freshly-cached, already-
            // loaded src whose `onLoad` won't fire. With a per-URL key we don't
            // need the load handler — only the error hide for unbundled sets.
            key={setIconUrl}
            src={setIconUrl}
            alt=""
            width={setSize}
            height={setSize}
            className="h-full w-full object-contain"
            style={{ filter: "drop-shadow(0 0 3px rgba(0,0,0,0.95))" }}
            onError={(e) => {
              // Safety net for set codenames we haven't bundled yet.
              ;(e.currentTarget as HTMLImageElement).style.display = "none"
            }}
          />
        </div>
      )}
    </>
  )
}

export function LowerTab({
  label,
  rarity,
  className,
}: {
  label?: string
  rarity: ModRarity
  className?: string
}) {
  if (!label) return null
  return (
    <div className={cn("relative h-[22px] w-[80%]", className)}>
      <img
        src={getModAssetUrl(rarity, "LowerTab")}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
      />
      <span className="absolute inset-0 flex items-center justify-center text-[9px] tracking-wider text-white uppercase">
        {label}
      </span>
    </div>
  )
}
