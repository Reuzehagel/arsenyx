import { getImageUrl } from "@/lib/warframe/images"
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text, react/jsx-key */
import type {
  BuildState,
  PlacedMod,
  PlacedArcane,
  ModSlot,
  Polarity,
} from "@/lib/warframe/types"

import type { PolarityIcons } from "./render"
import { IMAGE_DIMENSIONS } from "./render"

const COLORS = {
  bg: "#0f0f13",
  cardBg: "#1a1a21",
  border: "#2a2a35",
  text: "#fafafa",
  textMuted: "#b4b4bc",
  textDim: "#8a8a94",
  accent: "#3b82f6",
  emptySlot: "#15151b",
  polarityMatch: "#4ade80", // green-400
  polarityNeutral: "#6b7280", // gray-500
  polarityMismatch: "#f87171", // red-400
}

const CARD_WIDTH = 270
const CARD_GAP = 12
// Center 2 cards over the 4-card grid: (4w + 3g - (2w + g)) / 2
const CENTER_PADDING =
  (4 * CARD_WIDTH + 3 * CARD_GAP - (2 * CARD_WIDTH + CARD_GAP)) / 2

function getSlotPolarity(slot: ModSlot): Polarity | undefined {
  if (slot.formaPolarity === "universal" || slot.formaPolarity === "any")
    return "any"
  return slot.formaPolarity ?? slot.innatePolarity
}

/**
 * Determine polarity status:
 * - "match": slot polarity matches mod polarity, or universal forma (green)
 * - "mismatch": slot has polarity but doesn't match mod (red)
 * - "neutral": no slot polarity, or no mod (gray)
 */
function getPolarityStatus(
  slotPol: Polarity | undefined,
  slot: ModSlot,
  mod?: PlacedMod,
): "match" | "mismatch" | "neutral" {
  const fp = slot.formaPolarity
  if ((fp === "universal" || fp === "any") && mod) return "match"
  if (!slotPol || !mod) return "neutral"
  if (!mod.polarity) return "neutral"
  return slotPol === mod.polarity ? "match" : "mismatch"
}

function getPolarityColor(status: "match" | "mismatch" | "neutral"): string {
  switch (status) {
    case "match":
      return COLORS.polarityMatch
    case "mismatch":
      return COLORS.polarityMismatch
    case "neutral":
      return COLORS.polarityNeutral
  }
}

function ModCard({
  slot,
  imageSrc,
  polarityIcons,
}: {
  slot: ModSlot
  imageSrc?: string
  polarityIcons: PolarityIcons
}) {
  const mod = slot.mod!
  const slotPol = getSlotPolarity(slot)
  const status = getPolarityStatus(slotPol, slot, mod)
  const polColor = getPolarityColor(status)
  const polIconSrc = slotPol ? polarityIcons.tint(slotPol, polColor) : undefined

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        width: CARD_WIDTH,
        height: 72,
        overflow: "hidden",
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          width={48}
          height={48}
          style={{ borderRadius: 4, flexShrink: 0, objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            backgroundColor: COLORS.bg,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, color: COLORS.border }}>?</span>
        </div>
      )}

      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {mod.name || "Unknown"}
      </span>

      <div
        style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
      >
        {polIconSrc ? (
          <img src={polIconSrc} width={16} height={16} />
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <span style={{ fontSize: 12, color: COLORS.textDim, fontWeight: 500 }}>
          R{mod.rank ?? 0}
        </span>
      </div>
    </div>
  )
}

function EmptySlot({
  slot,
  polarityIcons,
}: {
  slot: ModSlot
  polarityIcons: PolarityIcons
}) {
  const slotPol = getSlotPolarity(slot)
  const polIconSrc = slotPol
    ? polarityIcons.tint(slotPol, COLORS.polarityNeutral)
    : undefined

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: CARD_WIDTH,
        height: 72,
        backgroundColor: COLORS.emptySlot,
        border: `1px dashed ${COLORS.border}`,
        borderRadius: 8,
        position: "relative",
      }}
    >
      {polIconSrc ? (
        <div
          style={{ position: "absolute", top: 8, right: 10, display: "flex" }}
        >
          <img src={polIconSrc} width={14} height={14} />
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}
      <span style={{ fontSize: 12, color: COLORS.border }}>Empty</span>
    </div>
  )
}

function ArcaneCard({
  arcane,
  imageSrc,
}: {
  arcane: PlacedArcane
  imageSrc?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.accent}`,
        borderRadius: 8,
        height: 56,
        width: CARD_WIDTH,
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          width={36}
          height={36}
          style={{ borderRadius: 4, flexShrink: 0, objectFit: "contain" }}
        />
      ) : (
        <div style={{ display: "flex" }} />
      )}
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {arcane.name || "Unknown"}
      </span>
      <span
        style={{
          fontSize: 12,
          color: COLORS.textDim,
          flexShrink: 0,
          fontWeight: 500,
        }}
      >
        R{arcane.rank ?? 0}
      </span>
    </div>
  )
}

function SlotCard({
  slot,
  imageMap,
  polarityIcons,
  label,
}: {
  slot: ModSlot
  imageMap: Map<string, string>
  polarityIcons: PolarityIcons
  label?: string
}) {
  const modImageUrl = slot.mod?.imageName
    ? getImageUrl(slot.mod.imageName)
    : undefined
  const modImageSrc = modImageUrl ? imageMap.get(modImageUrl) : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label ? (
        <span
          style={{
            fontSize: 11,
            color: COLORS.textDim,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      ) : (
        <div style={{ display: "flex" }} />
      )}
      {slot.mod ? (
        <ModCard
          slot={slot}
          imageSrc={modImageSrc}
          polarityIcons={polarityIcons}
        />
      ) : (
        <EmptySlot slot={slot} polarityIcons={polarityIcons} />
      )}
    </div>
  )
}

export interface BuildCardProps {
  buildState: BuildState
  buildName: string
  itemName: string
  authorName: string
  itemImageSrc?: string
  imageMap: Map<string, string>
  polarityIcons: PolarityIcons
}

export function BuildCardTemplate({
  buildState,
  buildName,
  itemName,
  authorName,
  itemImageSrc,
  imageMap,
  polarityIcons,
}: BuildCardProps) {
  const { normalSlots, auraSlots, exilusSlot, arcaneSlots, formaCount } =
    buildState

  const arcanes = (arcaneSlots ?? []).filter(
    (a): a is PlacedArcane => a !== null,
  )

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: IMAGE_DIMENSIONS.width,
        height: IMAGE_DIMENSIONS.height,
        backgroundColor: COLORS.bg,
        padding: "32px 36px",
        fontFamily: "Geist",
        color: COLORS.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginBottom: 28,
        }}
      >
        {itemImageSrc ? (
          <img
            src={itemImageSrc}
            width={72}
            height={72}
            style={{ borderRadius: 8, objectFit: "contain" }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              backgroundColor: COLORS.cardBg,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 28, color: COLORS.border }}>?</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {buildName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, color: COLORS.textMuted }}>
              {itemName} · by {authorName}
            </span>
            {formaCount > 0 ? (
              <span style={{ fontSize: 15, color: COLORS.textMuted }}>
                · {formaCount} forma
              </span>
            ) : (
              <div style={{ display: "flex" }} />
            )}
          </div>
        </div>

        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.textDim,
            letterSpacing: 2,
          }}
        >
          ARSENYX
        </span>
      </div>

      {/* Aura + Exilus centered over the mod grid */}
      <div
        style={{
          display: "flex",
          gap: CARD_GAP,
          marginBottom: 14,
          paddingLeft: CENTER_PADDING,
        }}
      >
        {auraSlots.length > 0 ? (
          auraSlots.map((auraSlot, i) => (
            <SlotCard
              key={`aura-${i}`}
              slot={auraSlot}
              imageMap={imageMap}
              polarityIcons={polarityIcons}
              label="Aura"
            />
          ))
        ) : (
          <div style={{ display: "flex" }} />
        )}
        {exilusSlot ? (
          <SlotCard
            slot={exilusSlot}
            imageMap={imageMap}
            polarityIcons={polarityIcons}
            label="Exilus"
          />
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>

      {/* Normal mod grid (4x2) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: CARD_GAP,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: CARD_GAP }}>
          {normalSlots.slice(0, 4).map((slot) => (
            <SlotCard
              slot={slot}
              imageMap={imageMap}
              polarityIcons={polarityIcons}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: CARD_GAP }}>
          {normalSlots.slice(4, 8).map((slot) => (
            <SlotCard
              slot={slot}
              imageMap={imageMap}
              polarityIcons={polarityIcons}
            />
          ))}
        </div>
      </div>

      {/* Arcanes centered over the mod grid */}
      {arcanes.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingLeft: CENTER_PADDING,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: COLORS.textDim,
              textTransform: "uppercase",
              letterSpacing: 1,
              fontWeight: 600,
            }}
          >
            Arcanes
          </span>
          <div style={{ display: "flex", gap: CARD_GAP }}>
            {arcanes.map((arcane) => {
              const arcaneImageUrl = arcane.imageName
                ? getImageUrl(arcane.imageName)
                : undefined
              const arcaneImageSrc = arcaneImageUrl
                ? imageMap.get(arcaneImageUrl)
                : undefined
              return <ArcaneCard arcane={arcane} imageSrc={arcaneImageSrc} />
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}
    </div>
  )
}
