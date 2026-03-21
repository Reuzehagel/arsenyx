/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text, react/jsx-key */
import type {
  BuildState,
  PlacedMod,
  PlacedArcane,
  ModSlot,
  Polarity,
} from "@/lib/warframe/types";
import { getImageUrl } from "@/lib/warframe/images";

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: "#09090b",
  cardBg: "#18181b",
  border: "#27272a",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textDim: "#71717a",
  accent: "#3b82f6",
  emptySlot: "#141417",
  polarityMatch: "#4ade80", // green-400
  polarityNeutral: "#71717a", // zinc-500
};

const RARITY_TEXT_COLORS: Record<string, string> = {
  Common: "#C79989",
  Uncommon: "#BEC0C2",
  Rare: "#FBECC4",
  Legendary: "#DFDFDF",
  Peculiar: "#DFDFDF",
  Riven: "#D9A8FF",
  Amalgam: "#98D9EB",
  Galvanized: "#7CB8E4",
};

function getRarityTextColor(rarity?: string): string {
  if (!rarity) return COLORS.textMuted;
  return RARITY_TEXT_COLORS[rarity] ?? COLORS.textMuted;
}

/**
 * Determine the effective polarity of a slot (forma overrides innate).
 */
function getSlotPolarity(slot: ModSlot): Polarity | undefined {
  if (slot.formaPolarity === "universal") return undefined;
  return slot.formaPolarity ?? slot.innatePolarity;
}

/**
 * Check if a mod's polarity matches the slot's effective polarity.
 */
function polarityMatches(slot: ModSlot, mod?: PlacedMod): boolean {
  if (!mod) return false;
  const slotPol = getSlotPolarity(slot);
  if (!slotPol || !mod.polarity) return false;
  return slotPol === mod.polarity;
}

function PolarityIcon({
  polarity,
  isMatch,
  polarityIcons,
  size,
}: {
  polarity: Polarity;
  isMatch: boolean;
  polarityIcons: Map<string, string>;
  size: number;
}) {
  const iconSrc = polarityIcons.get(polarity);
  if (!iconSrc) {
    return <div style={{ width: size, height: size, display: "flex" }} />;
  }
  return (
    <img
      src={iconSrc}
      width={size}
      height={size}
      style={{
        opacity: isMatch ? 1 : 0.5,
      }}
    />
  );
}

function ModCard({
  slot,
  imageSrc,
  polarityIcons,
}: {
  slot: ModSlot;
  imageSrc?: string;
  polarityIcons: Map<string, string>;
}) {
  const mod = slot.mod!;
  const textColor = getRarityTextColor(mod.rarity);
  const slotPol = getSlotPolarity(slot);
  const isMatch = polarityMatches(slot, mod);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        width: 270,
        height: 58,
        overflow: "hidden",
      }}
    >
      {/* Mod thumbnail */}
      {imageSrc ? (
        <img
          src={imageSrc}
          width={40}
          height={40}
          style={{ borderRadius: 4, flexShrink: 0, objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
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

      {/* Mod name */}
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

      {/* Polarity icon + Rank */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
        {slotPol ? (
          <PolarityIcon
            polarity={slotPol}
            isMatch={isMatch}
            polarityIcons={polarityIcons}
            size={14}
          />
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <span
          style={{
            fontSize: 11,
            color: isMatch ? COLORS.polarityMatch : COLORS.textDim,
          }}
        >
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
  polarityIcons: Map<string, string>;
}) {
  const slotPol = getSlotPolarity(slot);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 270,
        height: 58,
        backgroundColor: COLORS.emptySlot,
        border: `1px dashed ${COLORS.border}`,
        borderRadius: 8,
        position: "relative",
      }}
    >
      {slotPol ? (
        <div style={{ position: "absolute", top: 6, right: 8, display: "flex" }}>
          <PolarityIcon
            polarity={slotPol}
            isMatch={false}
            polarityIcons={polarityIcons}
            size={12}
          />
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
        padding: "6px 12px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.accent}`,
        borderRadius: 8,
        height: 48,
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          width={32}
          height={32}
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
  polarityIcons: Map<string, string>;
  label?: string;
}) {
  const modImageUrl = slot.mod?.imageName ? getImageUrl(slot.mod.imageName) : undefined;
  const modImageSrc = modImageUrl ? imageMap.get(modImageUrl) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {label && (
        <span style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </span>
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
  polarityIcons: Map<string, string>;
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
        width: WIDTH,
        height: HEIGHT,
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
          gap: 16,
          marginBottom: 24,
        }}
      >
        {itemImageSrc ? (
          <img
            src={itemImageSrc}
            width={60}
            height={60}
            style={{ borderRadius: 8, objectFit: "contain" }}
          />
        ) : (
          <div
            style={{
              width: 60,
              height: 60,
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
              fontSize: 24,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {buildName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, color: COLORS.textMuted }}>
              {itemName} · by {authorName}
            </span>
            {formaCount > 0 ? (
              <span style={{ fontSize: 13, color: COLORS.textMuted }}>
                · {formaCount} forma
              </span>) : (<div style={{ display: "flex" }} />
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
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {auraSlot ? (
          <SlotCard slot={auraSlot} imageMap={imageMap} polarityIcons={polarityIcons} label="Aura" />
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <SlotCard slot={exilusSlot} imageMap={imageMap} polarityIcons={polarityIcons} label="Exilus" />
      </div>

      {/* Normal mod grid (4x2) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {normalSlots.slice(0, 4).map((slot) => (
            <SlotCard slot={slot} imageMap={imageMap} polarityIcons={polarityIcons} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {normalSlots.slice(4, 8).map((slot) => (
            <SlotCard slot={slot} imageMap={imageMap} polarityIcons={polarityIcons} />
          ))}
        </div>
      </div>

      {/* Arcanes row */}
      {arcanes.length > 0 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
