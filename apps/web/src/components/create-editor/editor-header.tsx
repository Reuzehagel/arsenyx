import { Link as RouterLink } from "@tanstack/react-router"
import { Pencil, Settings2, Share2, UploadCloud, X } from "lucide-react"
import { useRef, useState } from "react"

import { type PublishVisibility } from "@/components/build-editor"
import { EndoFormaBadges } from "@/components/endo-forma-badges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { formatVisibility } from "@/lib/util/user-display"
import {
  getImageUrl,
  type BrowseCategory,
  type DetailItem,
} from "@/lib/warframe"

// Mac shows ⌘S; everything else shows Ctrl S. Computed once — the platform
// doesn't change mid-session. The matching hotkey is registered in
// editor-shell via useHotkey("mod+s").
const SAVE_HINT =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? "⌘S"
    : "Ctrl S"

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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Rename build"
                    onClick={startEdit}
                  >
                    <Pencil />
                  </Button>
                </>
              )}
            </div>
            <span className="text-muted-foreground text-sm">
              {item.name} · {categoryLabel}
            </span>
            <div className="flex items-center gap-3">
              <EndoFormaBadges
                totalEndoCost={totalEndoCost}
                formaCount={formaCount}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {settings && (
            <Button
              variant="outline"
              size="sm"
              onClick={settings.onEdit}
              title="Build settings"
            >
              <Settings2 data-icon="inline-start" />
              {formatVisibility(settings.visibility)}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            title="Copy shareable link"
          >
            <Share2 data-icon="inline-start" />
            Share
          </Button>
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
