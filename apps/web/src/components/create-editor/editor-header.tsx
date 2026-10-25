import { Link as RouterLink } from "@tanstack/react-router"
import {
  Pencil,
  Redo2,
  Settings2,
  Share2,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react"
import { type ReactElement, type ReactNode, useRef, useState } from "react"

import { type PublishVisibility } from "@/components/build-editor"
import { EndoFormaBadges } from "@/components/endo-forma-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatVisibility } from "@/lib/util/user-display"
import {
  getImageUrl,
  type BrowseCategory,
  type DetailItem,
} from "@/lib/warframe"

// Mac shows ⌘S; everything else shows Ctrl S. Computed once — the platform
// doesn't change mid-session. The matching hotkey is registered in
// editor-shell via useHotkey("mod+s").
const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
const SAVE_HINT = IS_MAC ? "⌘S" : "Ctrl S"
const UNDO_HINT = IS_MAC ? "⌘Z" : "Ctrl Z"
const REDO_HINT = IS_MAC ? "⌘⇧Z" : "Ctrl Shift Z"

/** Hover/focus hint for a header control (replaces native `title`). */
function Hint({
  label,
  children,
}: {
  label: ReactNode
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function EditorHeader({
  item,
  category,
  slug,
  buildSlug,
  categoryLabel,
  totalEndoCost,
  formaCount,
  buildName,
  displayImageName,
  onBuildNameChange,
  onSave,
  saveStatus,
  isSignedIn,
  history,
  draft,
  settings,
  onShare,
}: {
  item: DetailItem
  category: BrowseCategory
  slug: string
  buildSlug?: string
  categoryLabel: string
  totalEndoCost: number
  formaCount: number
  buildName: string
  displayImageName?: string
  onBuildNameChange: (name: string) => void
  onSave: () => void
  saveStatus: "idle" | "saving"
  isSignedIn: boolean
  /** Undo/redo controls for the active variant's build state. */
  history: {
    canUndo: boolean
    canRedo: boolean
    onUndo: () => void
    onRedo: () => void
  }
  /** Present when an autosaved draft is overriding the saved build. `label`
   *  reads "Reset to saved" (existing build) or "Discard draft" (new). */
  draft?: { label: string; onReset: () => void }
  settings?: { visibility: PublishVisibility; onEdit: () => void }
  onShare: () => void
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setEditing(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }
  const commit = () => {
    const trimmed = buildName.trim()
    onBuildNameChange(trimmed || item.name)
    setEditing(false)
  }
  return (
    <div className="bg-card mb-4 rounded-lg border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="bg-muted/10 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md md:size-24">
            <img
              src={getImageUrl(displayImageName ?? item.imageName)}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              {editing ? (
                <Input
                  ref={inputRef}
                  value={buildName}
                  onChange={(e) => onBuildNameChange(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit()
                    else if (e.key === "Escape") setEditing(false)
                  }}
                  className="h-8 text-xl font-bold tracking-tight md:text-2xl"
                />
              ) : (
                <>
                  <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:text-2xl">
                    {buildName}
                  </h1>
                  <Hint label="Rename build">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Rename build"
                      onClick={startEdit}
                    >
                      <Pencil />
                    </Button>
                  </Hint>
                </>
              )}
            </div>
            <span className="text-muted-foreground text-sm">
              {item.name} · {categoryLabel}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <EndoFormaBadges
                totalEndoCost={totalEndoCost}
                formaCount={formaCount}
              />
              {draft ? (
                <span className="inline-flex items-center gap-1">
                  <Hint label="Unsaved changes restored from a previous session">
                    <Badge variant="secondary" className="gap-1.5">
                      <span
                        className="bg-warning size-1.5 rounded-full"
                        aria-hidden
                      />
                      Draft
                    </Badge>
                  </Hint>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={draft.onReset}
                    className="text-muted-foreground h-auto px-1.5 py-0.5 text-xs"
                  >
                    {draft.label}
                  </Button>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup>
            <Hint
              label={
                <>
                  Undo <Kbd>{UNDO_HINT}</Kbd>
                </>
              }
            >
              <Button
                variant="outline"
                size="icon-sm"
                onClick={history.onUndo}
                disabled={!history.canUndo}
                aria-label="Undo"
              >
                <Undo2 />
              </Button>
            </Hint>
            <Hint
              label={
                <>
                  Redo <Kbd>{REDO_HINT}</Kbd>
                </>
              }
            >
              <Button
                variant="outline"
                size="icon-sm"
                onClick={history.onRedo}
                disabled={!history.canRedo}
                aria-label="Redo"
              >
                <Redo2 />
              </Button>
            </Hint>
          </ButtonGroup>
          {settings && (
            <Hint label="Build settings">
              <Button variant="outline" size="sm" onClick={settings.onEdit}>
                <Settings2 data-icon="inline-start" />
                {formatVisibility(settings.visibility)}
              </Button>
            </Hint>
          )}
          <Hint label="Copy shareable link">
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 data-icon="inline-start" />
              Share
            </Button>
          </Hint>
          <Button size="sm" onClick={onSave} disabled={saveStatus === "saving"}>
            <UploadCloud data-icon="inline-start" />
            {saveStatus === "saving"
              ? "Saving…"
              : isSignedIn
                ? "Save"
                : "Save (sign in)"}
            {isSignedIn && saveStatus !== "saving" ? (
              <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                {SAVE_HINT}
              </Kbd>
            ) : null}
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            // Renders as an <a> (RouterLink), which browsers default to a
            // pointer cursor — pin it to match the real <button> peers.
            className="cursor-default"
            render={
              buildSlug ? (
                <RouterLink to="/builds/$slug" params={{ slug: buildSlug }} />
              ) : (
                <RouterLink
                  to="/browse/$category/$slug"
                  params={{ category, slug }}
                />
              )
            }
          >
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
