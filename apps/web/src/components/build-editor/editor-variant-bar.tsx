import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { SavedVariant } from "@/lib/queries/build-query"
import { cn } from "@/lib/util/utils"

/**
 * Editor's per-variant tab bar with add / rename / duplicate / delete
 * affordances. Single-variant builds collapse to a single "+ Variant"
 * affordance so the bar stays visually quiet for the common case.
 */
export function EditorVariantBar({
  variants,
  activeIndex,
  onSwitch,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
}: {
  variants: SavedVariant[]
  activeIndex: number
  onSwitch: (index: number) => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRename: (label: string) => void
}) {
  // Hide the bar for single-variant builds until the user opts in via
  // "+ Variant". Keeps the editor visually identical to before for
  // anyone not using variants.
  if (variants.length === 1) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onAdd}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-md border border-dashed px-2 py-1 text-xs"
          title="Add a build variant"
        >
          + Variant
        </button>
      </div>
    )
  }
  const active = variants[activeIndex]
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
}: {
  variants: SavedVariant[]
  activeIndex: number
  active: SavedVariant
  atCap: boolean
  onSwitch: (index: number) => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRename: (label: string) => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [labelDraft, setLabelDraft] = useState(active.label)
  const inputRef = useRef<HTMLInputElement>(null)
  // Mirror renameActive's fallback so the input shows the normalized value
  // after blur — otherwise clearing the input and tabbing away leaves an
  // empty draft in the popover while the underlying variant has "Variant N".
  const commitRename = () => {
    const normalized =
      labelDraft.trim().slice(0, 24) || `Variant ${activeIndex + 1}`
    if (normalized !== labelDraft) setLabelDraft(normalized)
    onRename(normalized)
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pb-1">
      {variants.map((v, i) => {
        const isActive = i === activeIndex
        return (
          <div key={v.id || i} className="flex items-center gap-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSwitch(i)}
              className={cn(
                "rounded-l-md border px-3 py-1 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md border-transparent",
              )}
            >
              {v.label || `Variant ${i + 1}`}
            </button>
            {isActive ? (
              <Popover
                open={settingsOpen}
                onOpenChange={(o) => {
                  setSettingsOpen(o)
                  if (o) {
                    setLabelDraft(active.label)
                    requestAnimationFrame(() => {
                      inputRef.current?.focus()
                      inputRef.current?.select()
                    })
                  }
                }}
              >
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      title="Variant settings"
                      aria-label="Variant settings"
                      className="border-primary bg-primary text-primary-foreground rounded-r-md border border-l-0 px-1.5 py-1 text-sm"
                    >
                      ⚙
                    </button>
                  }
                />
                <PopoverContent
                  side="bottom"
                  align="center"
                  className="w-64 p-3"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-muted-foreground text-xs">
                      Name
                    </label>
                    <Input
                      ref={inputRef}
                      value={labelDraft}
                      maxLength={24}
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
                          commitRename()
                          onDuplicate()
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
                        className="flex-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAdd}
        disabled={atCap}
        title={
          atCap
            ? `Maximum of ${MAX_VARIANTS} variants per build`
            : "Add a build variant"
        }
        className={cn(
          "rounded-md border border-dashed px-2.5 py-1 text-sm",
          atCap
            ? "border-muted-foreground/20 text-muted-foreground/40 cursor-not-allowed"
            : "border-muted-foreground/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )}
      >
        + Variant
      </button>
    </div>
  )
}
