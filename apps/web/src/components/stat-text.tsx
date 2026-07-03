import { Fragment } from "react"

import {
  DAMAGE_TYPE_COLORS,
  DAMAGE_TYPE_ICON,
  DAMAGE_TYPE_LABELS,
  DAMAGE_TYPE_STYLE,
} from "@/lib/stats/types"
import { cn } from "@/lib/util/utils"

// In-game stat strings embed inline tokens from the UI:
//   <DT_FIRE_COLOR>Heat …    — colors the element name + icon
//   <LINE_SEPARATOR>         — explicit line break (alongside literal "\n")
//   <ENERGY>, <DT_SLASH>, …  — other tags we don't render specially; stripped
//
// The DT_*_COLOR tags are *unclosed* in the source data — they nominally
// color everything that follows until the next break. Rendering the entire
// trailing sentence in element color is visually noisy (issue #161
// feedback), so we narrow the colored span to just the element name plus
// an optional trailing keyword that forms one noun phrase with it
// (e.g. "Heat Status", "Cold proc", "Viral Damage"). The rest of the line
// reverts to normal text. Colors and icons come from the canonical
// DAMAGE_TYPE_* maps used by the weapon sidebar.

// Keywords that form one noun phrase with the element name. Verified against
// the full arcane + mod corpus: Status/Damage cover all arcane DT-segments;
// Resistance is the only additional trailing word that appears in mods
// (`Toxin Resistance`, `Heat Resistance`, …). Any other trailing word
// (`on Bullet Jump`, `and Viral`, `by 12%`) is a separate clause and stays
// in default text.
const DT_TRAILING_KEYWORD = /^( Status| Damage| Resistance)\b/

const DT_TOKEN_PATTERN = /<(DT_[A-Z_]+(?:_COLOR)?)>/

type Segment =
  | { kind: "text"; text: string }
  | { kind: "dt"; token: string; text: string }
  | { kind: "br" }

// Strip any remaining angle-bracket tokens (e.g. <ENERGY>, <DT_SLASH>) that
// we don't render specially. Equivalent to mod-card.tsx's old
// `stripInlineTags`, but limited to the residue left after DT extraction.
const RESIDUAL_TAG_PATTERN = /<[A-Z_][A-Z0-9_]*>/g

function stripResidualTags(text: string): string {
  return text.replace(RESIDUAL_TAG_PATTERN, "")
}

/**
 * Parse an in-game stat string into renderable segments. Handles `\\n` and
 * `<LINE_SEPARATOR>` as breaks, `<DT_*_COLOR>` as unclosed colored spans
 * (carrying until the next break or end-of-input), and strips other tags.
 */
export function parseStatText(input: string): Segment[] {
  const normalized = input
    .replace(/<LINE_SEPARATOR>/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\n/g, "\n")

  const segments: Segment[] = []
  const lines = normalized.split("\n")

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) segments.push({ kind: "br" })

    // Split keeping the captured DT token name; result alternates
    // [plain, token, plain, token, plain, …]
    const parts = line.split(DT_TOKEN_PATTERN)
    let activeToken: string | null = null

    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        // Only treat colored DT tokens (DT_*_COLOR) as carrying spans;
        // bare DT_SLASH / DT_SENTIENT etc. are stripped, not activated.
        activeToken = part.endsWith("_COLOR") ? part : null
        return
      }
      if (!part) return
      const cleaned = stripResidualTags(part)
      if (!cleaned) return

      if (activeToken) {
        segments.push({ kind: "dt", token: activeToken, text: cleaned })
      } else {
        segments.push({ kind: "text", text: cleaned })
      }
    })
  })

  return segments
}

interface StatTextProps {
  text: string
  /** Override icon size — defaults to 1em so it tracks surrounding text. */
  iconClassName?: string
}

/**
 * Render in-game stat / description text with inline element icons and
 * colored damage-type spans, matching the in-game tooltip styling.
 */
export function StatText({ text, iconClassName }: StatTextProps) {
  const segments = parseStatText(text)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "br") return <br key={i} />
        if (seg.kind === "text") return <Fragment key={i}>{seg.text}</Fragment>

        const damageType = DAMAGE_TYPE_COLORS[seg.token]
        if (!damageType) return <Fragment key={i}>{seg.text}</Fragment>

        const style = DAMAGE_TYPE_STYLE[damageType]
        const icon = DAMAGE_TYPE_ICON[damageType]
        const name = DAMAGE_TYPE_LABELS[damageType]

        // Split the segment into the colored prefix (element name +
        // optional trailing keyword) and the plain remainder. If the
        // segment doesn't start with the canonical element name
        // (unexpected data shape), color just the first word as a safe
        // fallback.
        let colored: string
        let rest: string
        if (seg.text.startsWith(name)) {
          colored = name
          rest = seg.text.slice(name.length)
          const trailing = rest.match(DT_TRAILING_KEYWORD)
          if (trailing) {
            colored += trailing[0]
            rest = rest.slice(trailing[0].length)
          }
        } else {
          // Stop at whitespace or trailing punctuation so an unexpected
          // "Heat," or "Heat:" doesn't fold the comma into the colored span.
          const firstWord = seg.text.match(/^[^\s,.:;!?]+/)
          colored = firstWord ? firstWord[0] : seg.text
          rest = firstWord ? seg.text.slice(firstWord[0].length) : ""
        }

        return (
          <Fragment key={i}>
            <span className={style.text}>
              {icon && (
                <img
                  src={icon}
                  alt=""
                  aria-hidden
                  className={cn(
                    "mr-0.5 inline-block h-[1em] w-[1em] -translate-y-px align-middle",
                    iconClassName,
                  )}
                />
              )}
              {colored}
            </span>
            {rest}
          </Fragment>
        )
      })}
    </>
  )
}
