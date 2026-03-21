/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text, react/jsx-key */
import type {
  BuildState,
  PlacedMod,
  PlacedArcane,
  ModSlot,
  Polarity,
} from "@/lib/warframe/types";
import { getImageUrl } from "@/lib/warframe/images";
import { RARITY_CONFIG, type ModRarity } from "@/lib/warframe/mod-card-config";
import type { PolarityIcons } from "./render";
import { IMAGE_DIMENSIONS } from "./render";

const COLORS = {
  bg: "#0f0f13",
  cardBg: "#1a1a21",
  border: "#2a2a35",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textDim: "#71717a",
  accent: "#3b82f6",
  emptySlot: "#15151b",
  polarityMatch: "#4ade80",   // green-400
  polarityNeutral: "#6b7280", // gray-500
  polarityMismatch: "#f87171", // red-400
};

function getRarityTextColor(rarity?: string): string {
  if (!rarity) return COLORS.textMuted;
  const config = RARITY_CONFIG[rarity as ModRarity];
  return config?.textColor ?? COLORS.textMuted;
}

function getSlotPolarity(slot: ModSlot): Polarity | undefined {
  if (slot.formaPolarity === "universal") return "any";
  return slot.formaPolarity ?? slot.innatePolarity;
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
  mod?: PlacedMod
): "match" | "mismatch" | "neutral" {
  if (slot.formaPolarity === "universal" && mod) return "match";
  if (!slotPol || !mod) return "neutral";
  if (!mod.polarity) return "neutral";
  return slotPol === mod.polarity ? "match" : "mismatch";
}

function getPolarityColor(status: "match" | "mismatch" | "neutral"): string {
  switch (status) {
    case "match": return COLORS.polarityMatch;
    case "mismatch": return COLORS.polarityMismatch;
    case "neutral": return COLORS.polarityNeutral;
  }
}

function ModCard({
  slot,
  imageSrc,
  polarityIcons,
}: {
  slot: ModSlot;
  imageSrc?: string;
  polarityIcons: PolarityIcons;
}) {
  const mod = slot.mod!;
  const textColor = getRarityTextColor(mod.rarity);
  const slotPol = getSlotPolarity(slot);
  const status = getPolarityStatus(slotPol, slot, mod);
  const polColor = getPolarityColor(status);
  const polIconSrc = slotPol ? polarityIcons.tint(slotPol, polColor) : undefined;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        width: 270,
        height: 64,
        overflow: "hidden",
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          width={44}
          height={44}
          style={{ borderRadius: 4, flexShrink: 0, objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            width: 44,
            height: 44,
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
          fontSize: 13,
          color: textColor,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {mod.name || "Unknown"}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {polIconSrc ? (
          <img src={polIconSrc} width={16} height={16} />
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <span style={{ fontSize: 11, color: COLORS.textDim }}>
          R{mod.rank ?? 0}
        </span>
      </div>
    </div>
  );
}

function EmptySlot({
  slot,
  polarityIcons,
}: {
  slot: ModSlot;
  polarityIcons: PolarityIcons;
}) {
  const slotPol = getSlotPolarity(slot);
  const polIconSrc = slotPol
    ? polarityIcons.tint(slotPol, COLORS.polarityNeutral)
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 270,
        height: 64,
        backgroundColor: COLORS.emptySlot,
        border: `1px dashed ${COLORS.border}`,
        borderRadius: 8,
        position: "relative",
      }}
    >
      {polIconSrc ? (
        <div style={{ position: "absolute", top: 8, right: 10, display: "flex" }}>
          <img src={polIconSrc} width={14} height={14} />
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}
      <span style={{ fontSize: 11, color: COLORS.border }}>Empty</span>
    </div>
  );
}

function ArcaneCard({
  arcane,
  imageSrc,
}: {
  arcane: PlacedArcane;
  imageSrc?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.accent}`,
        borderRadius: 8,
        height: 52,
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          width={34}
          height={34}
          style={{ borderRadius: 4, flexShrink: 0, objectFit: "contain" }}
        />
      ) : (
        <div style={{ display: "flex" }} />
      )}
      <span
        style={{
          fontSize: 13,
          color: COLORS.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {arcane.name || "Unknown"}
      </span>
      <span style={{ fontSize: 11, color: COLORS.textDim, flexShrink: 0 }}>
        R{arcane.rank ?? 0}
      </span>
    </div>
  );
}

function SlotCard({
  slot,
  imageMap,
  polarityIcons,
  label,
}: {
  slot: ModSlot;
  imageMap: Map<string, string>;
  polarityIcons: PolarityIcons;
  label?: string;
}) {
  const modImageUrl = slot.mod?.imageName ? getImageUrl(slot.mod.imageName) : undefined;
  const modImageSrc = modImageUrl ? imageMap.get(modImageUrl) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label ? (
        <span style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </span>
      ) : (
        <div style={{ display: "flex" }} />
      )}
      {slot.mod ? (
        <ModCard slot={slot} imageSrc={modImageSrc} polarityIcons={polarityIcons} />
      ) : (
        <EmptySlot slot={slot} polarityIcons={polarityIcons} />
      )}
    </div>
  );
}

export interface BuildCardProps {
  buildState: BuildState;
  buildName: string;
  itemName: string;
  authorName: string;
  itemImageSrc?: string;
  imageMap: Map<string, string>;
  polarityIcons: PolarityIcons;
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
  const { normalSlots, auraSlot, exilusSlot, arcaneSlots, formaCount } =
    buildState;

  const arcanes = (arcaneSlots ?? []).filter(
    (a): a is PlacedArcane => a !== null
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: IMAGE_DIMENSIONS.width,
        height: IMAGE_DIMENSIONS.height,
        backgroundColor: COLORS.bg,
        padding: "28px 32px",
        fontFamily: "Geist",
        color: COLORS.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {itemImageSrc ? (
          <img
            src={itemImageSrc}
            width={64}
            height={64}
            style={{ borderRadius: 8, objectFit: "contain" }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              backgroundColor: COLORS.cardBg,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 24, color: COLORS.border }}>?</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {buildName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15, color: COLORS.textMuted }}>
              {itemName} · by {authorName}
            </span>
            {formaCount > 0 ? (
              <span style={{ fontSize: 14, color: COLORS.textMuted }}>
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

      {/* Aura + Exilus row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {auraSlot ? (
          <SlotCard slot={auraSlot} imageMap={imageMap} polarityIcons={polarityIcons} label="Aura" />
        ) : (
          <div style={{ display: "flex" }} />
        )}
        {exilusSlot ? (
          <SlotCard slot={exilusSlot} imageMap={imageMap} polarityIcons={polarityIcons} label="Exilus" />
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>

      {/* Normal mod grid (4x2) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          {normalSlots.slice(0, 4).map((slot) => (
            <SlotCard slot={slot} imageMap={imageMap} polarityIcons={polarityIcons} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {normalSlots.slice(4, 8).map((slot) => (
            <SlotCard slot={slot} imageMap={imageMap} polarityIcons={polarityIcons} />
          ))}
        </div>
      </div>

      {/* Arcanes row */}
      {arcanes.length > 0 ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span
            style={{
              fontSize: 10,
              color: COLORS.textDim,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginRight: 4,
            }}
          >
            Arcanes
          </span>
          {arcanes.map((arcane) => {
            const arcaneImageUrl = arcane.imageName
              ? getImageUrl(arcane.imageName)
              : undefined;
            const arcaneImageSrc = arcaneImageUrl
              ? imageMap.get(arcaneImageUrl)
              : undefined;
            return <ArcaneCard arcane={arcane} imageSrc={arcaneImageSrc} />;
          })}
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}
    </div>
  );
}
