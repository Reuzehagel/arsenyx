import { getModSetCode, isStanceMod } from "@arsenyx/shared/warframe/mods"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { Fragment, useLayoutEffect, useRef, useState } from "react"

import {
  DISPLAY_SIZE,
  type ModRarity,
  getModAssetUrl,
  getRarityColor,
  getSetIconUrl,
} from "@/lib/mod-card-config"
import { getImageUrl } from "@/lib/warframe"

import { StatText } from "../stat-text"
import { baseDrainForMod } from "./calculations"
import {
  DrainBadge,
  type DrainMatchState,
  LowerTab,
  ModSlotBadge,
  RankCompleteLine,
} from "./mod-card-frame"
import { modMaxRank } from "./slot-ranks"
import {
  isAuraMod,
  isExilusCompatible,
  isPlexusAuraMod,
} from "./use-build-slots"

/* =============================================================================
 * PROTOTYPE — single-tree morphing mod card.
 *
 * Replaces the compact/expanded crossfade (mod-card.tsx) with one element tree
 * whose layers slide apart. Compact and expanded are the same layout at two
 * heights, so nothing needs to dissolve into anything else:
 *
 *   - frame top      → translates up
 *   - frame bottom   → translates down
 *   - art            → rides the frame top; never resizes (see ART note)
 *   - name           → travels from its compact spot into the stats panel
 *   - rails          → extend from the middle out
 *   - stats / tab    → revealed by the opening clip
 *
 * There are no opacity crossfades anywhere. The only non-positional animation
 * is the art's darkening lifting, which is a property change on one image, not
 * two layers trading places.
 *
 * Not wired into the app. See routes/proto.mod-card.tsx for the harness.
 * ========================================================================== */

// --- Geometry -----------------------------------------------------------
// Every offset is derived from DISPLAY_SIZE + the magic numbers already
// present in mod-card.tsx / mod-card-frame.tsx, so the compact end of the
// morph is pixel-identical to today's compact card and can't drift if the
// display sizes change.

const W = DISPLAY_SIZE.expanded.width // 184
const H_C = DISPLAY_SIZE.compact.height // 64
const H_E = DISPLAY_SIZE.expanded.height // 285

/** Compact `-bottom-8` on FrameBottom (mod-card-frame.tsx). */
const FRAME_BOTTOM_OVERHANG = 32
/** Compact `-bottom-[27px]` on RankDots. */
const DOTS_OVERHANG = 27
/** Compact `-bottom-[28px]` on RankCompleteLine. */
const RANK_LINE_OVERHANG = 28
/** Compact art window's `-bottom-4`. */
const ART_OVERHANG = 16

const BODY_INSET_Y = 4
const EXPANDED_DOTS_BOTTOM = 4

/** Compact name sits at 70% of the compact card's height (mod-card.tsx). */
const COMPACT_NAME_Y_PCT = 0.7
const COMPACT_NAME_PX = 16
const EXPANDED_NAME_PX = 14

/** Top edge of the compact card inside the expanded-size stage. The stage is
 * always 184×285 and the compact state is centred in it — matching where the
 * existing hover portal anchors, so the card grows equally up and down. */
const CY = (H_E - H_C) / 2 // 110.5

/** Compact-state Y offsets. Expanded state is always 0. */
const HEADER_DY = CY // +110.5 — frame top rides up
const FOOTER_DY = CY + H_C + FRAME_BOTTOM_OVERHANG - H_E // -78.5 — rides down
const DOTS_DY = CY + H_C + DOTS_OVERHANG - (H_E - EXPANDED_DOTS_BOTTOM) // -79.5
const RANK_LINE_DY = CY + H_C + RANK_LINE_OVERHANG - (H_E - BODY_INSET_Y) // -78.5

/** Body reveal clip, in stage coordinates. Compact clips to the compact card's
 * interior; expanded opens to the full frame interior. Everything that only
 * exists on the expanded card lives inside this, so it gets curtained in by
 * the opening frame instead of appearing over dead space. */
const CLIP_TOP_C = CY + BODY_INSET_Y // 114.5
const CLIP_BOTTOM_EDGE_C = CY + H_C + ART_OVERHANG // 190.5
const CLIP_BOTTOM_C = H_E - CLIP_BOTTOM_EDGE_C // 94.5
/** Matches the frame's interior. Must NOT be widened to 0 to let the rails
 * reach further out — that also stops clipping the art and background, and
 * they bleed past the frame's bevel at the card's edge. */
const CLIP_X = 3

/** The frame ornaments overlay the card's top and bottom: FrameTop is 248×41
 * scaled to 184 wide (≈30px tall) and FrameBottom is 252×85 (≈62px), sitting
 * flush at each end. So the open interior runs y≈30 → y≈223, and the rails
 * have to stay inside that or they poke out through the ornaments. */
const FRAME_TOP_H = 30
const FRAME_BOTTOM_H = 62

/** Centre of the compact name, in stage coordinates. */
const COMPACT_NAME_CY = CY + H_C * COMPACT_NAME_Y_PCT // 155.3

// --- Timing -------------------------------------------------------------

const OPEN_MS = 170
const CLOSE_MS = 110
const EASE = "cubic-bezier(0.33, 1, 0.68, 1)"

/** Sub-ranges over the open, so the scrubber and the live transition tell the
 * same story. Live delays are these fractions × OPEN_MS. Almost everything
 * runs on `frame` — the card opens as one object. */
const SEG = {
  frame: [0, 1],
  /** The art's darkening lifts slightly ahead of the frame settling. */
  artBrighten: [0, 0.45],
} as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Clamp a global 0..1 progress into a sub-range's own 0..1. */
function seg(t: number, range: readonly [number, number]): number {
  const [start, end] = range
  if (t <= start) return 0
  if (t >= end) return 1
  return (t - start) / (end - start)
}

/** Approximates EASE closely enough that scrubbed frames look like playback. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** Offset of `el` from `stage`, ignoring transforms — getBoundingClientRect
 * would fold in whatever transform the morph currently has applied, which is
 * exactly what we're trying to measure the resting position underneath. */
function offsetWithin(el: HTMLElement, stage: HTMLElement) {
  let top = 0
  let left = 0
  let node: HTMLElement | null = el
  while (node && node !== stage) {
    top += node.offsetTop
    left += node.offsetLeft
    node = node.offsetParent as HTMLElement | null
  }
  return { top, left }
}

// --- Layers -------------------------------------------------------------

/** Seated inside the frame interior (see FRAME_TOP_H / FRAME_BOTTOM_H) with a
 * couple of px of breathing room, so the rail never protrudes through the top
 * or bottom ornament. Explicit height rather than top+bottom because the rail
 * is a stretched 16×256 strip — with `h-auto` the intrinsic ratio would win
 * and it'd stop short. */
const RAIL_TOP = FRAME_TOP_H + 2 // 32
const RAIL_H = H_E - FRAME_BOTTOM_H - RAIL_TOP - 2 // 189

function SideRails({ rarity, t }: { rarity: ModRarity; t: number }) {
  // 16×256 vertical light strips — shipped for every rarity under
  // public/mod-components/ and referenced by getModAssetUrl, but never
  // rendered anywhere in the app until now.
  //
  // They extend from the middle out rather than fading: at t=0 the rail is
  // scaled to nothing, so the compact card shows none of it, and no opacity
  // ramp is involved. z-[18] keeps them above the art (z-10) and the stats
  // panel (z-15) — in-game they're lighting on the frame itself.
  const src = getModAssetUrl(rarity, "SideLight")
  const style = (mirrored: boolean): React.CSSProperties => ({
    transform: `scaleY(${t})${mirrored ? " scaleX(-1)" : ""}`,
    transformOrigin: "center",
  })
  return (
    <>
      <img
        src={src}
        alt=""
        className="pointer-events-none absolute left-[3px] z-[18] w-[9px]"
        style={{ top: RAIL_TOP, height: RAIL_H, ...style(false) }}
      />
      <img
        src={src}
        alt=""
        className="pointer-events-none absolute right-[3px] z-[18] w-[9px]"
        style={{ top: RAIL_TOP, height: RAIL_H, ...style(true) }}
      />
    </>
  )
}

function CornerLights({ rarity, t }: { rarity: ModRarity; t: number }) {
  const src = getModAssetUrl(rarity, "CornerLights")
  const style = (mirrored: boolean): React.CSSProperties => ({
    transform: `scale(${t})${mirrored ? " scaleX(-1)" : ""}`,
    transformOrigin: "center",
  })
  return (
    <>
      <img
        src={src}
        alt=""
        className="pointer-events-none absolute bottom-[30px] left-[-4px] z-[18] w-[26px]"
        style={style(false)}
      />
      <img
        src={src}
        alt=""
        className="pointer-events-none absolute right-[-4px] bottom-[30px] z-[18] w-[26px]"
        style={style(true)}
      />
    </>
  )
}

/** Rank dots, inlined rather than reused from mod-card-frame so the prototype
 * can position them in stage coordinates instead of variant-keyed classes. */
function Dots({ rank, maxRank }: { rank: number; maxRank: number }) {
  if (maxRank === 0) return null
  return (
    <div className="pointer-events-none flex gap-0.5">
      {Array.from({ length: maxRank }, (_, i) => (
        <div
          key={i}
          className={
            i < rank
              ? "h-[5px] w-[5px] rounded-full bg-sky-300"
              : "h-[5px] w-[5px] rounded-full bg-zinc-600/60"
          }
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

function statLines(mod: Mod, rank: number): string[] {
  if (!mod.levelStats?.length) return []
  const i = Math.min(rank, mod.levelStats.length - 1)
  return mod.levelStats[i]?.stats ?? []
}

// --- Card ---------------------------------------------------------------

export interface ModCardMorphProps {
  mod: Mod
  rarity: ModRarity
  rank: number
  /** Live mode: the card transitions to this state. */
  open: boolean
  /** Scrub mode: drive the morph directly at this 0..1 progress and disable
   * all CSS transitions. Used by the harness to capture exact mid-frames. */
  progress?: number
  drainOverride?: number
  matchState?: DrainMatchState
  /** Both default OFF. The rail and corner-light art ships for every rarity
   * but has never been rendered in the app, and turning it on changes the
   * resting look of every expanded card — not just the hover. Kept behind
   * flags so the harness can still show them. */
  showRails?: boolean
  showCornerLights?: boolean
}

export function ModCardMorph({
  mod,
  rarity,
  rank,
  open,
  progress,
  drainOverride,
  matchState = "neutral",
  showRails = false,
  showCornerLights = false,
}: ModCardMorphProps) {
  const scrubbing = progress != null
  const p = scrubbing
    ? easeOutCubic(Math.min(1, Math.max(0, progress)))
    : open
      ? 1
      : 0

  // In live mode p is only ever 0 or 1 and CSS interpolates between them; in
  // scrub mode p is fractional and we interpolate ourselves. Same expressions
  // either way, so the two modes can't disagree.
  const ms = open ? OPEN_MS : CLOSE_MS
  const tr = (fraction: readonly [number, number], prop = "all") => {
    if (scrubbing) return "none"
    const [start, end] = fraction
    // Delays only apply on the way in; closing collapses everything at once.
    const delay = open ? start * ms : 0
    const dur = open ? (end - start) * ms : ms
    return `${prop} ${dur}ms ${EASE} ${delay}ms`
  }

  const tFrame = seg(p, SEG.frame)
  const tBrighten = seg(p, SEG.artBrighten)

  const maxRank = modMaxRank(mod)
  const drain = drainOverride ?? baseDrainForMod(mod, rank)
  const color = getRarityColor(rarity)
  const stats = statLines(mod, rank)
  const setSize = mod.modSetStats?.length ?? 0
  const setBonus = setSize > 0 ? mod.modSetStats?.[setSize - 1] : undefined
  const compatLabel =
    mod.compatName ||
    (mod.type ? mod.type.replace(" Mod", "").toUpperCase() : "")

  const slotKind = isStanceMod(mod)
    ? ("stance" as const)
    : isAuraMod(mod) || isPlexusAuraMod(mod)
      ? ("aura" as const)
      : isExilusCompatible(mod)
        ? ("exilus" as const)
        : null
  const setIconUrl = getSetIconUrl(getModSetCode(mod), rarity)

  const isOversizedTop =
    rarity === "Amalgam" || rarity === "Galvanized" || rarity === "Riven"

  // --- FLIP measurement for the travelling name + the stats panel ---------
  // The name's resting position is wherever the panel's flow puts it, which
  // depends on how many stat lines the mod has — so it has to be measured
  // rather than hardcoded. The panel keeps an invisible copy of the name to
  // hold that space; the visible name is positioned absolutely in stage
  // coordinates and travels to meet it.
  const stageRef = useRef<HTMLDivElement>(null)
  const nameSlotRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState<{
    nameTop: number
    nameLeft: number
    nameWidth: number
    nameHeight: number
    panelTop: number
  } | null>(null)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const slot = nameSlotRef.current
    const panel = panelRef.current
    if (!stage || !slot || !panel) return
    const n = offsetWithin(slot, stage)
    const pnl = offsetWithin(panel, stage)
    setMetrics({
      nameTop: n.top,
      nameLeft: n.left,
      nameWidth: slot.offsetWidth,
      nameHeight: slot.offsetHeight,
      panelTop: pnl.top,
    })
  }, [mod.name, rank, stats.length, setBonus, compatLabel])

  // Compact-state transform for the name: translate from its resting centre up
  // to the compact centre, and scale 14px → 16px. Scale rather than font-size
  // so it can't reflow mid-flight.
  const nameDY = metrics
    ? COMPACT_NAME_CY - (metrics.nameTop + metrics.nameHeight / 2)
    : 0
  const nameScale = COMPACT_NAME_PX / EXPANDED_NAME_PX

  // The panel must be clear of the compact clip window at t=0 or its stats
  // would show through the compact card. Most mods' panels already sit below
  // it (dy 0, pure reveal); tall ones get pushed down just far enough.
  const panelDY = metrics
    ? Math.max(0, CLIP_BOTTOM_EDGE_C - metrics.panelTop)
    : 0

  const clipPath = `inset(${lerp(CLIP_TOP_C, BODY_INSET_Y, tFrame)}px ${CLIP_X}px ${lerp(CLIP_BOTTOM_C, BODY_INSET_Y, tFrame)}px ${CLIP_X}px)`

  return (
    <div
      ref={stageRef}
      className="relative select-none"
      style={{ width: W, height: H_E, isolation: "isolate" }}
    >
      {/* ---- Body: everything the frame opens to reveal ---- */}
      <div
        className="absolute inset-0"
        style={{ clipPath, transition: tr(SEG.frame, "clip-path") }}
      >
        {/* Background texture. No fade — in the compact state the clip window
            is entirely covered by the art, so there's nothing to hide. */}
        <img
          src={getModAssetUrl(rarity, "Background")}
          alt=""
          className="absolute inset-x-[3px] top-[4px] bottom-[4px] z-[5] h-auto w-auto rounded-b-[20px] object-cover object-bottom"
        />

        {showRails && <SideRails rarity={rarity} t={tFrame} />}
        {showCornerLights && <CornerLights rarity={rarity} t={tFrame} />}

        {/* Art — ONE layer, no crossfade.
         *
         * Mod art is always a 256×256 square, which makes the compact and
         * expanded treatments geometrically identical: `object-cover` in the
         * 178×76 compact window and `object-contain` in the 178×277 expanded
         * window both resolve to a 178×178 top-aligned render. Nothing about
         * the image needs to resize — so we drop object-fit entirely (w-full +
         * h-auto gives the same 178×178) and let the art ride up on the
         * header's transform while the body clip opens over it. The only thing
         * that animates on the image is the darkening lifting. */}
        <div
          className="absolute top-[4px] right-[3px] left-[3px] z-10"
          style={{
            transform: `translateY(${lerp(HEADER_DY, 0, tFrame)}px)`,
            transition: tr(SEG.frame, "transform"),
          }}
        >
          <img
            src={getImageUrl(mod.imageName)}
            alt=""
            className="h-auto w-full"
            style={{
              filter: `grayscale(${lerp(0.7, 0, tBrighten)}) brightness(${lerp(0.35, 1, tBrighten)})`,
              transition: tr(SEG.artBrighten, "filter"),
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: color,
              mixBlendMode: "hard-light",
              opacity: lerp(0.15, 0, tBrighten),
              transition: tr(SEG.artBrighten, "opacity"),
            }}
          />
        </div>

        {/* Expanded body panel — stats, set bonus, compat tab. Revealed by the
            clip rather than faded in. The name inside is an invisible spacer;
            the real one travels (below). */}
        <div
          ref={panelRef}
          className="absolute right-[3px] bottom-[20px] left-[3px] z-[15]"
          style={{
            transform: `translateY(${lerp(panelDY, 0, tFrame)}px)`,
            transition: tr(SEG.frame, "transform"),
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src={getModAssetUrl(rarity, "Background")}
              alt=""
              className="h-full w-full object-cover object-bottom"
            />
          </div>
          <div className="relative z-20 flex flex-col items-center px-2 pt-1.5 pb-2">
            {/* `w-full` matters: the visible name is given this element's
                measured width, and without a shared constraint the two wrap at
                different points — a two-word mod like Galvanized Diffusion
                reserves one line here and renders two over there, dropping the
                overflow onto the stats. */}
            <span
              ref={nameSlotRef}
              aria-hidden
              className="w-full text-center text-[14px] leading-tight font-medium"
              style={{
                fontFamily: "Roboto, sans-serif",
                color,
                visibility: "hidden",
              }}
            >
              {mod.name}
            </span>
            {stats.length > 0 && (
              <div className="mt-1 flex w-full flex-col items-center gap-1 px-1">
                <span
                  className="text-center text-[12px] leading-snug font-normal text-gray-300"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  {stats.map((line, i) => (
                    <Fragment key={i}>
                      {i > 0 && <br />}
                      <StatText text={line} />
                    </Fragment>
                  ))}
                </span>
              </div>
            )}
            {setBonus && (
              <div className="mt-1 w-full px-1 text-center">
                <span className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                  Set Bonus
                </span>
                <div className="text-[11px] leading-snug font-normal text-gray-300">
                  <StatText text={setBonus} />
                </div>
              </div>
            )}
            <LowerTab label={compatLabel} rarity={rarity} className="mt-1" />
          </div>
        </div>

        {/* The one real name. Travels from the compact position into the panel
            slot measured above; never crossfades with a second copy. */}
        {metrics && (
          <span
            className="absolute z-30 block text-center text-[14px] leading-tight font-medium"
            style={{
              top: metrics.nameTop,
              left: metrics.nameLeft,
              width: metrics.nameWidth,
              fontFamily: "Roboto, sans-serif",
              color,
              // The heavy outline is what makes the name legible over art in
              // the compact state; it eases off as the name lands on the panel.
              textShadow: `0 0 ${lerp(6, 0, tFrame)}px #000, 0 0 ${lerp(12, 2, tFrame)}px #000`,
              transform: `translateY(${lerp(nameDY, 0, tFrame)}px) scale(${lerp(nameScale, 1, tFrame)})`,
              transformOrigin: "center",
              transition: scrubbing
                ? "none"
                : `${tr(SEG.frame, "transform")}, ${tr(SEG.frame, "text-shadow")}`,
            }}
          >
            {mod.name}
          </span>
        )}
      </div>

      {/* ---- Header group: frame top + the badges pinned to it ---- */}
      <div
        className="absolute inset-x-0 top-0 z-20"
        style={{
          transform: `translateY(${lerp(HEADER_DY, 0, tFrame)}px)`,
          transition: tr(SEG.frame, "transform"),
        }}
      >
        <img
          src={getModAssetUrl(rarity, "FrameTop")}
          alt=""
          className={
            isOversizedTop
              ? "pointer-events-none absolute -top-2 left-1/2 h-auto w-[110%] max-w-none -translate-x-1/2"
              : "pointer-events-none absolute top-0 left-1/2 w-full -translate-x-1/2"
          }
        />
        <DrainBadge
          drain={drain}
          polarity={mod.polarity}
          rarity={rarity}
          matchState={matchState}
        />
        <ModSlotBadge
          slotKind={slotKind}
          setIconUrl={setIconUrl}
          rarity={rarity}
        />
      </div>

      {/* ---- Footer group: frame bottom ---- */}
      <div
        className="absolute inset-x-0 bottom-0 z-20"
        style={{
          transform: `translateY(${lerp(FOOTER_DY, 0, tFrame)}px)`,
          transition: tr(SEG.frame, "transform"),
        }}
      >
        <img
          src={getModAssetUrl(rarity, "FrameBottom")}
          alt=""
          className={
            isOversizedTop
              ? "pointer-events-none absolute bottom-0 left-1/2 h-auto w-[110%] max-w-none -translate-x-1/2"
              : "pointer-events-none absolute bottom-0 left-1/2 w-full -translate-x-1/2"
          }
        />
      </div>

      {maxRank > 0 && rank >= maxRank && (
        <div
          className="absolute inset-x-0 z-25"
          style={{
            bottom: BODY_INSET_Y,
            transform: `translateY(${lerp(RANK_LINE_DY, 0, tFrame)}px)`,
            transition: tr(SEG.frame, "transform"),
          }}
        >
          <RankCompleteLine
            rarity={rarity}
            className="absolute bottom-0 left-1/2 w-[calc(100%-8px)] -translate-x-1/2"
          />
        </div>
      )}

      {/* ---- Rank dots: track the frame bottom ----
          No `-translate-x-1/2` class here: Tailwind v4 emits translate utilities
          on the standalone `translate` property, which composes *on top of* an
          inline `transform` rather than being overridden by it — the two
          -50%s stack and the dots land hard left. Centring is done inline. */}
      <div
        className="absolute left-1/2 z-30"
        style={{
          bottom: EXPANDED_DOTS_BOTTOM,
          transform: `translateX(-50%) translateY(${lerp(DOTS_DY, 0, tFrame)}px)`,
          transition: tr(SEG.frame, "transform"),
        }}
      >
        <Dots rank={rank} maxRank={maxRank} />
      </div>
    </div>
  )
}
