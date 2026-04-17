import { Plus } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types";

import { ModCard } from "./mod-card";
import { PolarityIcon } from "./polarity-icon";
import { PolarityPicker } from "./polarity-picker";

export type ModSlotKind = "normal" | "aura" | "exilus";

interface ModSlotProps {
  kind?: ModSlotKind;
  slotPolarity?: Polarity;
  /**
   * Forma polarity. `undefined` → use innate. `"universal"` → explicitly
   * cleared (overrides innate). Any other value stamps that polarity.
   */
  formaPolarity?: Polarity;
  mod?: Mod;
  rank?: number;
  /** Whether this slot is the current placement target. */
  selected?: boolean;
  /** LClick: toggle select / open picker (fires for both empty and filled). */
  onClick?: () => void;
  /** RClick: remove the placed mod. Only meaningful when `mod` is set. */
  onRemove?: () => void;
  /** Apply a polarity (including `"universal"` to clear). */
  onPickPolarity?: (polarity: Polarity) => void;
  /** Rank delta from `-` / `=` while the slot is hovered. */
  onRankChange?: (delta: number) => void;
}

const KIND_LABEL: Record<ModSlotKind, string> = {
  normal: "",
  aura: "Aura",
  exilus: "Exilus",
};

/** `"universal"` forma is a real value that means "explicitly cleared". */
function effectivePolarity(
  innate?: Polarity,
  forma?: Polarity,
): Polarity | undefined {
  if (forma !== undefined) {
    return forma === "universal" ? undefined : forma;
  }
  return innate;
}

export function ModSlot({
  kind = "normal",
  slotPolarity,
  formaPolarity,
  mod,
  rank = 0,
  selected,
  onClick,
  onRemove,
  onPickPolarity,
  onRankChange,
}: ModSlotProps) {
  const effective = effectivePolarity(slotPolarity, formaPolarity);
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Rank hotkeys while hovering a filled slot.
  useEffect(() => {
    if (!mod || !hovered || !onRankChange) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable)
          return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        onRankChange(-1);
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        onRankChange(1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mod, hovered, onRankChange]);

  const handleContextMenu = (e: MouseEvent) => {
    if (mod && onRemove) {
      e.preventDefault();
      onRemove();
    }
  };

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger
        render={<div />}
        data-build-slot
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          // Identical dimensions for empty and filled states so a row's
          // height/width never shifts based on how many mods are placed.
          "group relative flex h-[80px] w-full flex-col items-center justify-center transition-colors",
          "sm:h-[90px] sm:w-[150px] md:h-[100px] md:w-[184px]",
          "cursor-pointer",
          !mod && "rounded-md border-2 bg-muted/20",
          !mod &&
            (selected
              ? "border-solid border-white/80"
              : "border-muted-foreground/20 hover:border-muted-foreground/50 border-dashed"),
          mod && selected && "ring-2 ring-white/60 rounded-md",
        )}
      >
        {mod ? (
          <ModCard mod={mod} rank={rank} disableHover={pickerOpen} />
        ) : (
          <>
            {effective && (
              <PolarityIcon
                polarity={effective}
                className="absolute top-2 right-2 size-4 opacity-30"
              />
            )}
            <Plus className="text-muted-foreground/20 group-hover:text-muted-foreground/40 size-5 transition-colors" />
            {KIND_LABEL[kind] && (
              <span className="text-muted-foreground/50 mt-1 font-mono text-[10px] uppercase tracking-wide">
                {KIND_LABEL[kind]}
              </span>
            )}
          </>
        )}
      </PopoverTrigger>
      {onPickPolarity && (
        <PopoverContent className="w-auto">
          <PolarityPicker
            current={formaPolarity}
            onPick={(p) => {
              onPickPolarity(p);
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}
