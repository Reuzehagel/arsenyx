import { cn } from "@/lib/utils";
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types";

import { ModCard } from "./mod-card";
import { PolarityIcon } from "./polarity-icon";

export type ModSlotKind = "normal" | "aura" | "exilus";

interface ModSlotProps {
  kind?: ModSlotKind;
  /** Pre-forma polarity on the slot itself. */
  slotPolarity?: Polarity;
  mod?: Mod;
  rank?: number;
  active?: boolean;
  onClick?: () => void;
}

const KIND_LABEL: Record<ModSlotKind, string> = {
  normal: "",
  aura: "Aura",
  exilus: "Exilus",
};

/**
 * Visual build slot. Empty variant shows a dashed frame with an optional
 * slot-polarity stamp and category label (Aura / Exilus). Filled variant
 * delegates to ModCard. No click-to-remove or drop target behavior yet.
 */
export function ModSlot({
  kind = "normal",
  slotPolarity,
  mod,
  rank = 0,
  active,
  onClick,
}: ModSlotProps) {
  if (mod) {
    return <ModCard mod={mod} rank={rank} onClick={onClick} />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "border-muted-foreground/20 bg-muted/20 relative flex aspect-[3/4] w-full flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors",
        active && "border-primary bg-primary/10",
        onClick && "hover:border-muted-foreground/50 cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      {slotPolarity && slotPolarity !== "universal" && slotPolarity !== "any" && (
        <PolarityIcon polarity={slotPolarity} className="size-4" />
      )}
      {KIND_LABEL[kind] && (
        <span className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase tracking-wide">
          {KIND_LABEL[kind]}
        </span>
      )}
    </button>
  );
}
