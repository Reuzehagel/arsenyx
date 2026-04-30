import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { Pencil, Plus, X, type LucideIcon } from "lucide-react"
import { useState, type MouseEvent } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import {
  auraBonusForMod,
  effectiveDrainForMod,
  effectivePolarity,
  getMatchState,
} from "./calculations"
import { ModCard } from "./mod-card"
import { PolarityIcon } from "./polarity-icon"
import { PolarityPicker } from "./polarity-picker"
import { useRankHotkey } from "./use-rank-hotkey"

export type ModSlotKind = "normal" | "aura" | "exilus"

interface ModSlotProps {
  kind?: ModSlotKind
  slotPolarity?: Polarity
  /**
   * Forma polarity. `undefined` → use innate. `"universal"` → explicitly
   * cleared (overrides innate). Any other value stamps that polarity.
   */
  formaPolarity?: Polarity
  mod?: Mod
  rank?: number
  /** Whether this slot is the current placement target. */
  selected?: boolean
  /** LClick: toggle select / open picker (fires for both empty and filled). */
  onClick?: () => void
  /** RClick: remove the placed mod. Only meaningful when `mod` is set. */
  onRemove?: () => void
  /** Apply a polarity (including `"universal"` to clear). */
  onPickPolarity?: (polarity: Polarity) => void
  /** Rank delta from `-` / `=` while the slot is hovered. */
  onRankChange?: (delta: number) => void
  /** Pencil-button handler, only rendered for riven mods. */
  onEditRiven?: () => void
  /** Disables click/hover/remove/picker/rank-hotkey. */
  readOnly?: boolean
}

const KIND_LABEL: Record<ModSlotKind, string> = {
  normal: "",
  aura: "Aura",
  exilus: "Exilus",
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
  onEditRiven,
  readOnly = false,
}: ModSlotProps) {
  const effective = effectivePolarity(slotPolarity, formaPolarity)
  const [hovered, setHovered] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // The picker can only be open while this slot is the selected one. Tying
  // open-state to `selected` lets arrow-key nav implicitly close the popover
  // on the previously-clicked slot without a separate close effect.
  const popoverOpen = pickerOpen && !!selected

  useRankHotkey({
    enabled: !readOnly && !!mod && hovered && !!onRankChange,
    onDelta: (d) => onRankChange?.(d),
  })

  const handleContextMenu = (e: MouseEvent) => {
    if (readOnly) return
    if (mod && onRemove) {
      e.preventDefault()
      onRemove()
    }
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger
        nativeButton={false}
        // Slots are driven by arrow-key navigation (window-scoped, see
        // use-keyboard-nav.ts), not by Tab traversal. Keeping them out of the
        // tab order avoids the browser focus ring visually enlarging the
        // focused slot relative to its neighbors.
        render={<div tabIndex={-1} />}
        data-build-slot
        onClick={readOnly ? undefined : onClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={readOnly ? undefined : () => setHovered(true)}
        onMouseLeave={readOnly ? undefined : () => setHovered(false)}
        className={cn(
          // Fixed 184×100 to match the underlying ModCard (mod-card-config.ts
          // DISPLAY_SIZE). The grid auto-rearranges its column count based on
          // the loadout wrap width — see mod-grid.tsx — so individual
          // slots stay a constant size and never need to shrink.
          "group relative flex h-[100px] w-[184px] flex-col items-center justify-center transition-colors",
          // `selected` is the single source of visual truth; suppress the
          // default focus ring so a clicked-then-arrowed-away slot doesn't
          // keep highlighting alongside the new selection.
          "outline-none",
          !readOnly && "cursor-pointer",
          !mod && "rounded-md border",
          !mod &&
            !readOnly &&
            (selected
              ? "border-solid border-white/70"
              : "border-muted-foreground/10 hover:border-muted-foreground/25 border-dashed"),
          !mod && readOnly && "border-muted-foreground/10 border-dashed",
          mod && selected && !readOnly && "rounded-md ring-2 ring-white/60",
        )}
      >
        {mod ? (
          <>
            <ModCard
              mod={mod}
              rank={rank}
              disableHover={popoverOpen}
              drainOverride={
                kind === "aura"
                  ? auraBonusForMod(mod, rank, effective)
                  : effectiveDrainForMod(mod, rank, effective)
              }
              matchState={getMatchState(mod.polarity, effective)}
            />
            {!readOnly && (onRemove || (isRivenMod(mod) && onEditRiven)) && (
              // Mobile: always visible (no hover). Desktop: appear on slot
              // hover via CSS group-hover (parent has `group`) so we don't
              // re-render the slot for a purely visual transition.
              <div className="absolute -top-2 -right-2 z-30 flex flex-col gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                {onRemove && (
                  <SlotIconButton
                    icon={X}
                    label="Remove mod"
                    onClick={onRemove}
                  />
                )}
                {isRivenMod(mod) && onEditRiven && (
                  <SlotIconButton
                    icon={Pencil}
                    label="Edit riven stats"
                    onClick={onEditRiven}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {effective && (
              <PolarityIcon
                polarity={effective}
                className="absolute top-2 right-2 size-4 opacity-20"
              />
            )}
            <Plus className="text-muted-foreground/15 group-hover:text-muted-foreground/30 size-5 transition-colors" />
            {KIND_LABEL[kind] && (
              <span className="text-muted-foreground/30 mt-1 font-mono text-[10px] tracking-wide uppercase">
                {KIND_LABEL[kind]}
              </span>
            )}
          </>
        )}
      </PopoverTrigger>
      {!readOnly && onPickPolarity && (
        <PopoverContent className="w-auto">
          <PolarityPicker
            current={formaPolarity}
            onPick={(p) => {
              onPickPolarity(p)
              setPickerOpen(false)
            }}
          />
        </PopoverContent>
      )}
    </Popover>
  )
}

function SlotIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="bg-background/80 text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-5 items-center justify-center rounded-full border"
    >
      <Icon className="size-3" />
    </button>
  )
}
