import type {
  SavedVariant,
  VariantMode,
} from "@arsenyx/shared/warframe/build-data"
import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"
import { Plus, Settings2 } from "lucide-react"
import { useState } from "react"

import {
  VARIANT_TRACK,
  VariantTab,
} from "@/components/build-loadout/variant-tab"
import { FormToggle } from "@/components/form-toggle"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MAX_VARIANT_LABEL,
  normalizeVariantLabel,
  variantDisplayLabel,
} from "@/lib/build/variants"

/**
 * Editor's per-variant tab bar with add / rename / duplicate / delete
 * affordances. Single-variant builds collapse to a bare "+ Copy" / "+ Variant"
 * pair so the bar stays visually quiet for the common case.
 */
export function EditorVariantBar({
  variants,
  activeIndex,
  onSwitch,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
  formNames,
  activeFormIndex,
  onSwitchForm,
  variantMode,
  onVariantModeChange,
}: {
  /** Whether variants share one forma + shard set (build-wide). */
  variantMode: VariantMode
  onVariantModeChange: (mode: VariantMode) => void
  variants: SavedVariant[]
  activeIndex: number
  onSwitch: (index: number) => void
  onAdd: () => void
  onDuplicate: (label?: string) => void
  onDelete: () => void
  onRename: (label: string) => void
  /** Twin-frames (Sirius & Orion): the switchable form names. When present,
   *  a top-level form toggle renders above the variant tabs and `variants`
   *  is already filtered to the active form. */
  formNames?: string[]
  activeFormIndex?: number
  onSwitchForm?: (formIndex: number) => void
}) {
  // Hide the tab bar for single-variant builds until the user opts in.
  // Keeps the editor visually quiet for anyone not using variants, but both
  // ways in — blank and copy — are offered here so seeding a second variant
  // from the current one doesn't cost a round trip through the tab bar's
  // gear popover. Twin-frames (formNames present) always show the full bar
  // so the form picker stays reachable even with one variant.
  if (variants.length === 1 && !formNames) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDuplicate()}
                className="text-muted-foreground"
              />
            }
          >
            <Plus data-icon="inline-start" />
            Copy
          </TooltipTrigger>
          <TooltipContent>
            Add a variant that starts as a copy of this build
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdd}
                className="text-muted-foreground"
              />
            }
          >
            <Plus data-icon="inline-start" />
            Variant
          </TooltipTrigger>
          <TooltipContent>Add an empty build variant</TooltipContent>
        </Tooltip>
      </div>
    )
  }
  const active = variants[activeIndex]
  // `variants` is the active form's list for twin-frames, so this length is the
  // per-form count → the cap is naturally per-form.
  const atCap = variants.length >= MAX_VARIANTS
  return (
    <EditorVariantBarMulti
      variants={variants}
      activeIndex={activeIndex}
      active={active}
      atCap={atCap}
      onSwitch={onSwitch}
      onAdd={onAdd}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onRename={onRename}
      formNames={formNames}
      activeFormIndex={activeFormIndex}
      onSwitchForm={onSwitchForm}
      variantMode={variantMode}
      onVariantModeChange={onVariantModeChange}
    />
  )
}

function EditorVariantBarMulti({
  variants,
  activeIndex,
  active,
  atCap,
  onSwitch,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
  formNames,
  activeFormIndex = 0,
  onSwitchForm,
  variantMode,
  onVariantModeChange,
}: {
  variants: SavedVariant[]
  activeIndex: number
  active: SavedVariant
  atCap: boolean
  onSwitch: (index: number) => void
  onAdd: () => void
  onDuplicate: (label?: string) => void
  onDelete: () => void
  onRename: (label: string) => void
  formNames?: string[]
  activeFormIndex?: number
  onSwitchForm?: (formIndex: number) => void
  variantMode: VariantMode
  onVariantModeChange: (mode: VariantMode) => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [labelDraft, setLabelDraft] = useState(active.label)
  // Show the normalized value after blur, so clearing the input leaves
  // "Variant N" in the popover, matching the variant.
  const commitRename = () => {
    const normalized = normalizeVariantLabel(labelDraft, activeIndex)
    if (normalized !== labelDraft) setLabelDraft(normalized)
    onRename(normalized)
  }
  return (
    <div className="flex flex-col items-center gap-1.5 pb-2">
      {formNames && onSwitchForm ? (
        <FormToggle
          formNames={formNames}
          activeFormIndex={activeFormIndex}
          onSelect={onSwitchForm}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <div
          role="tablist"
          aria-label="Build variants"
          className={VARIANT_TRACK}
        >
          {variants.map((v, i) => (
            <VariantTab
              key={v.id || i}
              active={i === activeIndex}
              onClick={() => onSwitch(i)}
            >
              {variantDisplayLabel(v, i)}
            </VariantTab>
          ))}
        </div>
        {/* One options button for the active variant, outside the track, so
            every tab keeps the same shape. */}
        <Popover
          open={settingsOpen}
          onOpenChange={(o) => {
            setSettingsOpen(o)
            if (o) setLabelDraft(active.label)
          }}
        >
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                title={`Rename, duplicate or delete “${variantDisplayLabel(active, activeIndex)}”`}
                aria-label="Variant options"
              />
            }
          >
            <Settings2 />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="center" className="w-64 p-3">
            <Field>
              <FieldLabel htmlFor="variant-name" className="text-xs">
                Name
              </FieldLabel>
              <Input
                id="variant-name"
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                value={labelDraft}
                maxLength={MAX_VARIANT_LABEL}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitRename()
                    setSettingsOpen(false)
                  } else if (e.key === "Escape") {
                    setSettingsOpen(false)
                  }
                }}
                className="h-8 text-sm"
              />
              <div className="mt-1 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Pass the pending label: a rename queued in the same
                    // click would be overwritten by the duplicate.
                    onDuplicate(normalizeVariantLabel(labelDraft, activeIndex))
                    setSettingsOpen(false)
                  }}
                  disabled={atCap}
                  title={
                    atCap
                      ? `Maximum of ${MAX_VARIANTS} variants per build`
                      : "Duplicate this variant"
                  }
                  className="flex-1"
                >
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    onDelete()
                    setSettingsOpen(false)
                  }}
                  disabled={variants.length <= 1}
                  title={
                    variants.length <= 1
                      ? "Each form keeps at least one variant"
                      : "Delete this variant"
                  }
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </Field>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          disabled={atCap}
          title={
            atCap
              ? `Maximum of ${MAX_VARIANTS} variants per build`
              : "Add an empty build variant"
          }
          className="text-muted-foreground"
        >
          <Plus data-icon="inline-start" />
          Variant
        </Button>
        <span aria-hidden className="bg-border mx-0.5 h-4 w-px" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground font-normal"
                onClick={() =>
                  onVariantModeChange(
                    variantMode === "linked" ? "independent" : "linked",
                  )
                }
              />
            }
          >
            Forma &amp; shards:{" "}
            <span className="text-foreground font-medium">
              {variantMode === "linked" ? "shared" : "per variant"}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            {variantMode === "linked"
              ? "Every variant uses the same forma and Archon Shards, like configs of one item in-game. Click to let each variant have its own."
              : "Each variant has its own forma and Archon Shards. Click to make every variant use this variant's."}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
