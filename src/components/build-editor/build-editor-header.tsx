"use client"

import { useEffect, useRef, useState } from "react"
import {
  Check,
  Diamond,
  Gem,
  Loader2,
  Pencil,
  Save,
  UploadCloud,
  X,
} from "lucide-react"
import Image from "next/image"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getImageUrl } from "@/lib/warframe/images"

import { PublishDialog, type Visibility } from "./publish-dialog"

export interface BuildEditorHeaderProps {
  item: { name: string; imageName?: string }
  categoryLabel: string
  totalEndoCost: number
  formaCount: number
  isOwner: boolean
  isEditMode: boolean
  setIsEditMode: (v: boolean) => void
  savedBuildId?: string
  canEdit: boolean
  isAuthenticated: boolean
  buildName: string
  setBuildName: (name: string) => void
  buildId: string | undefined
  saveStatus: "idle" | "saving" | "saved" | "error"
  publishDialogOpen: boolean
  setPublishDialogOpen: (open: boolean) => void
  handlePublish: (visibility: Visibility) => Promise<void>
  handleCancel: () => void
  handleCopyBuild: () => Promise<void>
  showCopied: boolean
}

export function BuildEditorHeader({
  item,
  categoryLabel,
  totalEndoCost,
  formaCount,
  isOwner,
  isEditMode,
  setIsEditMode,
  savedBuildId,
  canEdit,
  isAuthenticated,
  buildName,
  setBuildName,
  buildId,
  saveStatus,
  publishDialogOpen,
  setPublishDialogOpen,
  handlePublish,
  handleCancel,
  handleCopyBuild,
  showCopied,
}: BuildEditorHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canEditName = canEdit && isAuthenticated

  useEffect(() => {
    if (isEditingName) inputRef.current?.focus()
  }, [isEditingName])

  return (
    <>
      {/* Header Card */}
      <div className="bg-card mb-4 rounded-lg border p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="bg-muted/10 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md md:h-24 md:w-24">
              <Image
                src={getImageUrl(item.imageName)}
                alt={item.name}
                fill
                unoptimized
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-2">
              <div className="flex items-center gap-2">
                {canEditName && isEditingName ? (
                  <>
                    <input
                      ref={inputRef}
                      value={buildName}
                      onChange={(e) => setBuildName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setIsEditingName(false)
                      }}
                      placeholder="Build name…"
                      className="text-foreground min-w-0 flex-1 border-b border-b-current bg-transparent p-0 text-xl leading-tight font-bold tracking-tight outline-none md:text-2xl"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsEditingName(false)}
                    >
                      <Check />
                    </Button>
                  </>
                ) : (
                  <>
                    <h1 className="truncate border-b border-b-transparent text-xl leading-tight font-bold tracking-tight md:text-2xl">
                      {buildName || item.name}
                    </h1>
                    {canEditName && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Pencil />
                      </Button>
                    )}
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
                  <Diamond className="size-3 fill-current" />
                  {totalEndoCost.toLocaleString()}
                </Badge>
                {formaCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
                  >
                    <Gem className="size-3" />
                    {formaCount}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {/* Edit button for owners in view mode */}
          {isOwner && !isEditMode && savedBuildId && (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => setIsEditMode(true)}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            </div>
          )}
          {/* Editing controls */}
          {canEdit && (
            <div className="flex gap-2">
              {isAuthenticated ? (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => setPublishDialogOpen(true)}
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saving" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : buildId ? (
                    <Save className="size-4" />
                  ) : (
                    <UploadCloud className="size-4" />
                  )}
                  <span className="hidden sm:inline">
                    {saveStatus === "saving"
                      ? "Saving..."
                      : saveStatus === "saved"
                        ? "Saved!"
                        : saveStatus === "error"
                          ? "Error"
                          : buildId
                            ? "Update"
                            : "Publish"}
                  </span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleCopyBuild}
                >
                  <Save className="size-4" />
                  <span className="hidden sm:inline">
                    {showCopied ? "Copied!" : "Copy Link"}
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleCancel}
              >
                <X className="size-4" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        onPublish={handlePublish}
        isPublishing={saveStatus === "saving"}
        isUpdate={!!buildId}
      />
    </>
  )
}
