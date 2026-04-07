"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const DescriptionEditor = dynamic(
  () => import("./description-editor").then((mod) => mod.DescriptionEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] rounded-md" />,
  },
)
import type { PartnerBuild } from "./partner-build-card"
import {
  PartnerBuildSelector,
  type PartnerBuildOption,
} from "./partner-build-selector"

const SUMMARY_MAX_LENGTH = 400
const SUMMARY_WARNING_THRESHOLD = 300
const EMPTY_PARTNER_BUILDS: PartnerBuild[] = []
const EMPTY_AVAILABLE_BUILDS: PartnerBuildOption[] = []

export interface GuideEditorData {
  summary: string
  description: string
  partnerBuildIds: string[]
}

interface GuideEditorProps {
  buildId: string
  initialSummary?: string | null
  initialDescription?: string | null
  initialPartnerBuilds?: PartnerBuild[]
  availableBuilds?: PartnerBuildOption[]
  onSave?: (data: GuideEditorData) => void | Promise<void>
  onSummaryChange?: (summary: string) => void
  onDescriptionChange?: (description: string) => void
  showPartnerBuilds?: boolean
  showSaveButtons?: boolean
}

export function GuideEditor({
  buildId,
  initialSummary,
  initialDescription,
  initialPartnerBuilds = EMPTY_PARTNER_BUILDS,
  availableBuilds = EMPTY_AVAILABLE_BUILDS,
  onSave,
  onSummaryChange,
  onDescriptionChange,
  showPartnerBuilds = true,
  showSaveButtons = true,
}: GuideEditorProps) {
  const [summary, setSummary] = useState(initialSummary ?? "")
  const [description, setDescription] = useState(initialDescription ?? "")
  const [partnerBuilds, setPartnerBuilds] =
    useState<PartnerBuild[]>(initialPartnerBuilds)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  )
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<"none" | "save" | "reset">(
    "none",
  )

  // Track if there are unsaved changes
  const hasChanges = useCallback(() => {
    const summaryChanged = summary !== (initialSummary ?? "")
    const descriptionChanged = description !== (initialDescription ?? "")
    const partnersChanged =
      JSON.stringify(partnerBuilds.map((b) => b.id).sort()) !==
      JSON.stringify(initialPartnerBuilds.map((b) => b.id).sort())
    return summaryChanged || descriptionChanged || partnersChanged
  }, [
    summary,
    description,
    partnerBuilds,
    initialSummary,
    initialDescription,
    initialPartnerBuilds,
  ])

  // Reset state when initial values change
  useEffect(() => {
    setSummary(initialSummary ?? "")
    setDescription(initialDescription ?? "")
    setPartnerBuilds(initialPartnerBuilds)
    setSaveStatus("idle")
  }, [initialSummary, initialDescription, initialPartnerBuilds])

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveStatus("idle")

    try {
      const data: GuideEditorData = {
        summary: summary.trim(),
        description: description.trim(),
        partnerBuildIds: partnerBuilds.map((b) => b.id),
      }

      if (onSave) {
        await onSave(data)
      }

      setSaveStatus("saved")
      window.setTimeout(() => setSaveStatus("idle"), 3000)
    } catch (error) {
      console.error("Failed to save guide:", error)
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }, [summary, description, partnerBuilds, onSave])

  // Handle reset with unsaved changes check
  const handleReset = () => {
    if (hasChanges()) {
      setPendingAction("reset")
      setShowDiscardDialog(true)
    } else {
      doReset()
    }
  }

  const doReset = () => {
    setSummary(initialSummary ?? "")
    setDescription(initialDescription ?? "")
    setPartnerBuilds(initialPartnerBuilds)
    setSaveStatus("idle")
    setShowDiscardDialog(false)
    setPendingAction("none")
  }

  const handleDiscardConfirm = () => {
    if (pendingAction === "reset") {
      doReset()
    } else {
      setShowDiscardDialog(false)
      setPendingAction("none")
    }
  }

  // Handle partner build add/remove
  const handleAddPartner = (buildId: string) => {
    const build = availableBuilds.find((b) => b.id === buildId)
    if (build) {
      setPartnerBuilds((prev) => [
        ...prev,
        {
          id: build.id,
          slug: build.slug,
          name: build.name,
          item: build.item,
          buildData: {
            formaCount: build.buildData.formaCount,
          } as PartnerBuild["buildData"],
        },
      ])
    }
  }

  const handleRemovePartner = (buildId: string) => {
    setPartnerBuilds((prev) => prev.filter((b) => b.id !== buildId))
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Summary Section */}
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="guide-summary" className="text-sm">
              Summary
            </FieldLabel>
            {summary.length > SUMMARY_WARNING_THRESHOLD && (
              <span
                className={cn(
                  "text-xs",
                  summary.length > SUMMARY_MAX_LENGTH
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {summary.length}/{SUMMARY_MAX_LENGTH}
              </span>
            )}
          </div>
          <Textarea
            id="guide-summary"
            placeholder="Brief description of this build (optional)…"
            value={summary}
            onChange={(e) => {
              const newValue = e.target.value.slice(0, SUMMARY_MAX_LENGTH)
              setSummary(newValue)
              onSummaryChange?.(newValue)
            }}
            rows={2}
            className="resize-none text-sm"
            disabled={isSaving}
          />
        </Field>

        {/* Description Section */}
        <Field>
          <FieldLabel className="text-sm">Description</FieldLabel>
          <DescriptionEditor
            description={description}
            onDescriptionChange={(newValue) => {
              setDescription(newValue)
              onDescriptionChange?.(newValue)
            }}
            rows={20}
            toolbarSize="sm"
            previewMinHeight="min-h-[200px]"
          />
        </Field>

        {/* Partner Builds Section */}
        {showPartnerBuilds && (
          <Field>
            <FieldLabel className="text-sm">Partner Builds</FieldLabel>
            <PartnerBuildSelector
              currentBuildId={buildId}
              selectedBuilds={partnerBuilds}
              availableBuilds={availableBuilds}
              onAdd={handleAddPartner}
              onRemove={handleRemovePartner}
            />
          </Field>
        )}

        {/* Save Buttons */}
        {showSaveButtons && (
          <div className="flex items-center gap-2 pt-2">
            {saveStatus === "saved" && (
              <span className="text-positive text-sm">Saved</span>
            )}
            {saveStatus === "error" && (
              <span className="text-destructive text-sm">Error saving</span>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges()}
              size="sm"
            >
              Save
            </Button>
            <Button
              onClick={handleReset}
              disabled={isSaving || !hasChanges()}
              variant="outline"
              size="sm"
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Discard Changes Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDiscardDialog(false)
                setPendingAction("none")
              }}
            >
              Keep Changes
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
