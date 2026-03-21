/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text, react/jsx-key */
import type {
  BuildState,
  PlacedMod,
  PlacedArcane,
  ModSlot,
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
  forma: "#38bdf8", // sky-400
};

const RARITY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Common: { text: "#C79989", bg: "#1a1210", border: "#3d2820" },
  Uncommon: { text: "#BEC0C2", bg: "#151618", border: "#35373a" },
  Rare: { text: "#FBECC4", bg: "#1a1810", border: "#3d3520" },
  Legendary: { text: "#DFDFDF", bg: "#171717", border: "#3a3a3a" },
  Peculiar: { text: "#DFDFDF", bg: "#171717", border: "#3a3a3a" },
  Riven: { text: "#D9A8FF", bg: "#1a1020", border: "#352050" },
  Amalgam: { text: "#98D9EB", bg: "#101820", border: "#203040" },
  Galvanized: { text: "#7CB8E4", bg: "#101520", border: "#203050" },
};

function getRarityColors(rarity?: string) {
  if (!rarity) return { text: COLORS.border, bg: COLORS.cardBg, border: COLORS.border };
  return RARITY_COLORS[rarity] ?? { text: COLORS.border, bg: COLORS.cardBg, border: COLORS.border };
}

function ModCard({
  mod,
  imageSrc,
  hasForma,
}: {
  mod: PlacedMod;
  imageSrc?: string;
  hasForma: boolean;
}) {
  const colors = getRarityColors(mod.rarity);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${COLORS.cardBg} 100%)`,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        width: 260,
        height: 50,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Mod thumbnail */}
      {imageSrc ? (
        <img
          src={imageSrc}
          width={36}
          height={36}
          style={{ borderRadius: 4, flexShrink: 0, objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            backgroundColor: colors.bg,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, color: colors.border }}>?</span>
        </div>
      )}

      {/* Mod name */}
      <span
        style={{
          fontSize: 12,
          color: colors.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {mod.name}
      </span>

      {/* Rank + forma indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {hasForma && (
          <span style={{ fontSize: 10, color: COLORS.forma, fontWeight: 700 }}>◆</span>
        )}
        <span style={{ fontSize: 10, color: COLORS.textDim }}>
          R{mod.rank}
        </span>
      </div>
    </div>
  );
}

function EmptySlot({ hasForma }: { hasForma: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 260,
        height: 50,
        backgroundColor: COLORS.emptySlot,
        border: `1px dashed ${COLORS.border}`,
        borderRadius: 6,
        position: "relative",
      }}
    >
      {hasForma && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 6,
            fontSize: 10,
            color: COLORS.forma,
            fontWeight: 700,
          }}
        >
          ◆
        </span>
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
        gap: 6,
        padding: "4px 10px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.accent}`,
        borderRadius: 6,
        height: 42,
      }}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          width={28}
          height={28}
          style={{ borderRadius: 4, flexShrink: 0, objectFit: "contain" }}
        />
      )}
      <span
        style={{
          fontSize: 12,
          color: COLORS.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {arcane.name}
      </span>
      <span style={{ fontSize: 10, color: COLORS.textDim, flexShrink: 0 }}>
        R{arcane.rank}
      </span>
    </div>
  );
}

function SlotRow({
  slot,
  imageMap,
  label,
}: {
  slot: ModSlot;
  imageMap: Map<string, string>;
  label?: string;
}) {
  const hasForma = !!slot.formaPolarity;
  const modImageUrl = slot.mod?.imageName ? getImageUrl(slot.mod.imageName) : undefined;
  const modImageSrc = modImageUrl ? imageMap.get(modImageUrl) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {label && (
        <span style={{ fontSize: 9, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </span>
      )}
      {slot.mod ? (
        <ModCard mod={slot.mod} imageSrc={modImageSrc} hasForma={hasForma} />
      ) : (
        <EmptySlot hasForma={hasForma} />
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
}

export function BuildCardTemplate({
  buildState,
  buildName,
  itemName,
  authorName,
  itemImageSrc,
  imageMap,
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
        {/* Item image */}
        {itemImageSrc ? (
          <img
            src={itemImageSrc}
            width={56}
            height={56}
            style={{ borderRadius: 8, objectFit: "contain" }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              backgroundColor: COLORS.cardBg,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 22, color: COLORS.border }}>?</span>
          </div>
        )}

        {/* Build info */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {buildName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: COLORS.textMuted }}>
              {itemName} · by {authorName}
            </span>
            {formaCount > 0 && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 12,
                  color: COLORS.forma,
                  fontWeight: 700,
                }}
              >
                ◆ {formaCount}
              </span>
            )}
          </div>
        </div>

        {/* Branding */}
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: COLORS.textDim,
            letterSpacing: 2,
          }}
        >
          ARSENYX
        </span>
      </div>

      {/* Aura + Exilus row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {auraSlot && (
          <SlotRow slot={auraSlot} imageMap={imageMap} label="Aura" />
        )}
        <SlotRow slot={exilusSlot} imageMap={imageMap} label="Exilus" />
      </div>

      {/* Normal mod grid (4x2) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 14,
        }}
      >
        {/* Row 1: slots 0-3 */}
        <div style={{ display: "flex", gap: 6 }}>
          {normalSlots.slice(0, 4).map((slot) => (
            <SlotRow slot={slot} imageMap={imageMap} />
          ))}
        </div>
        {/* Row 2: slots 4-7 */}
        <div style={{ display: "flex", gap: 6 }}>
          {normalSlots.slice(4, 8).map((slot) => (
            <SlotRow slot={slot} imageMap={imageMap} />
          ))}
        </div>
      </div>

      {/* Arcanes row */}
      {arcanes.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontSize: 9,
              color: COLORS.textDim,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginRight: 2,
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
      )}
    </div>
  );
}
