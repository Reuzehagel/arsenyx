import { Link as RouterLink } from "@tanstack/react-router"
import { Check, Pencil, Settings2, Share2, UploadCloud, X } from "lucide-react"
import { useRef, useState } from "react"

import { type PublishVisibility } from "@/components/build-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVisibility } from "@/lib/user-display"
import {
  getImageUrl,
  type BrowseCategory,
  type DetailItem,
} from "@/lib/warframe"

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
  saveError,
  isSignedIn,
  settings,
  onShare,
  shareCopied,
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
  saveStatus: "idle" | "saving" | "error"
  saveError: string | null
  isSignedIn: boolean
  settings?: { visibility: PublishVisibility; onEdit: () => void }
  onShare: () => void
  shareCopied: boolean
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
              <Badge
                variant="secondary"
                className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
              >
                <img
                  src="/icons/currency/Endo.png"
                  alt=""
                  aria-hidden
                  className="size-4"
                />
                {totalEndoCost.toLocaleString("en-US")}
              </Badge>
              {formaCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
                >
                  <img
                    src="/icons/currency/Forma.png"
                    alt=""
                    aria-hidden
                    className="size-[18px] object-contain"
                  />
                  {formaCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "error" && saveError ? (
            <span className="text-destructive text-xs">{saveError}</span>
          ) : null}
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
            {shareCopied ? (
              <>
                <Check data-icon="inline-start" />
                Copied
              </>
            ) : (
              <>
                <Share2 data-icon="inline-start" />
                Share
              </>
            )}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saveStatus === "saving"}>
            <UploadCloud data-icon="inline-start" />
            {saveStatus === "saving"
              ? "Saving…"
              : isSignedIn
                ? "Save"
                : "Save (sign in)"}
          </Button>
          <Button
            variant="outline"
            size="sm"
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
