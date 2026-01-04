"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen,
  Save,
  X,
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  List,
  Eye,
  Pencil,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GuideReader } from "@/components/guides/guide-reader";
import {
  PartnerBuildSelector,
  type PartnerBuildOption,
} from "./partner-build-selector";
import type { PartnerBuild } from "./partner-build-card";

const SUMMARY_MAX_LENGTH = 400;
const SUMMARY_WARNING_THRESHOLD = 300;

export interface GuideEditorData {
  summary: string;
  description: string;
  partnerBuildIds: string[];
}

interface GuideEditorDialogProps {
  buildId: string;
  initialSummary?: string | null;
  initialDescription?: string | null;
  initialPartnerBuilds?: PartnerBuild[];
  availableBuilds?: PartnerBuildOption[];
  onSave?: (data: GuideEditorData) => void | Promise<void>;
  trigger?: React.ReactNode;
}

export function GuideEditorDialog({
  buildId,
  initialSummary,
  initialDescription,
  initialPartnerBuilds = [],
  availableBuilds = [],
  onSave,
  trigger,
}: GuideEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [partnerBuilds, setPartnerBuilds] =
    useState<PartnerBuild[]>(initialPartnerBuilds);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const scrollPositionRef = useRef(0);

  // Track if there are unsaved changes
  const hasChanges = useCallback(() => {
    const summaryChanged = summary !== (initialSummary ?? "");
    const descriptionChanged = description !== (initialDescription ?? "");
    const partnersChanged =
      JSON.stringify(partnerBuilds.map((b) => b.id).sort()) !==
      JSON.stringify(initialPartnerBuilds.map((b) => b.id).sort());
    return summaryChanged || descriptionChanged || partnersChanged;
  }, [
    summary,
    description,
    partnerBuilds,
    initialSummary,
    initialDescription,
    initialPartnerBuilds,
  ]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSummary(initialSummary ?? "");
      setDescription(initialDescription ?? "");
      setPartnerBuilds(initialPartnerBuilds);
      setMode("edit");
      setSaveStatus("idle");
    }
  }, [open, initialSummary, initialDescription, initialPartnerBuilds]);

  // Preserve scroll position when switching modes
  const handleModeSwitch = (newMode: "edit" | "preview") => {
    if (descriptionRef.current) {
      scrollPositionRef.current = descriptionRef.current.scrollTop;
    }
    setMode(newMode);
  };

  // Handle save
  const handleSave = useCallback(
    async (closeAfter: boolean) => {
      setIsSaving(true);
      setSaveStatus("idle");

      try {
        const data: GuideEditorData = {
          summary: summary.trim(),
          description: description.trim(),
          partnerBuildIds: partnerBuilds.map((b) => b.id),
        };

        if (onSave) {
          await onSave(data);
        }

        setSaveStatus("saved");

        if (closeAfter) {
          setTimeout(() => {
            setOpen(false);
          }, 300);
        }
      } catch (error) {
        console.error("Failed to save guide:", error);
        setSaveStatus("error");
      } finally {
        setIsSaving(false);
      }
    },
    [summary, description, partnerBuilds, onSave]
  );

  // Handle close with unsaved changes check
  const handleClose = () => {
    if (hasChanges()) {
      setPendingClose(true);
      setShowDiscardDialog(true);
    } else {
      setOpen(false);
    }
  };

  const handleDiscardConfirm = () => {
    setShowDiscardDialog(false);
    if (pendingClose) {
      setOpen(false);
      setPendingClose(false);
    }
  };

  // Handle partner build add/remove
  const handleAddPartner = (buildId: string) => {
    const build = availableBuilds.find((b) => b.id === buildId);
    if (build) {
      setPartnerBuilds((prev) => [
        ...prev,
        {
          id: build.id,
          slug: build.slug,
          name: build.name,
          item: build.item,
          buildData: { formaCount: build.buildData.formaCount } as PartnerBuild["buildData"],
        },
      ]);
    }
  };

  const handleRemovePartner = (buildId: string) => {
    setPartnerBuilds((prev) => prev.filter((b) => b.id !== buildId));
  };

  // Markdown toolbar helpers
  const insertMarkdown = (before: string, after: string, placeholder: string) => {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = description;
    const selectedText = text.substring(start, end);

    const insertText = selectedText || placeholder;
    const newText =
      text.substring(0, start) + before + insertText + after + text.substring(end);

    setDescription(newText);

    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(
          start + before.length,
          start + before.length + selectedText.length
        );
      } else {
        textarea.setSelectionRange(
          start + before.length,
          start + before.length + placeholder.length
        );
      }
    }, 0);
  };

  const toolbarButtons = [
    {
      icon: Bold,
      label: "Bold",
      action: () => insertMarkdown("**", "**", "bold text"),
    },
    {
      icon: Italic,
      label: "Italic",
      action: () => insertMarkdown("*", "*", "italic text"),
    },
    {
      icon: Heading2,
      label: "Heading",
      action: () => insertMarkdown("\n## ", "\n", "Heading"),
    },
    {
      icon: LinkIcon,
      label: "Link",
      action: () => insertMarkdown("[", "](url)", "link text"),
    },
    {
      icon: List,
      label: "List",
      action: () => insertMarkdown("\n- ", "\n", "list item"),
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          handleClose();
        } else {
          setOpen(true);
        }
      }}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Guide
            </Button>
          )}
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-[900px] w-[95vw] max-h-[95vh] flex flex-col"
          showCloseButton={false}
          onPointerDownOutside={(e) => {
            if (hasChanges()) {
              e.preventDefault();
              handleClose();
            }
          }}
        >
          {/* Custom top-right action buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {saveStatus === "saved" && (
              <span className="text-sm text-green-600 dark:text-green-400 mr-2">
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-sm text-destructive mr-2">Error</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSaving}
            >
              Save & Close
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-70 hover:opacity-100"
              onClick={handleClose}
              disabled={isSaving}
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <DialogHeader className="pr-48">
            <DialogTitle>Build Guide</DialogTitle>
            <DialogDescription>
              Write a guide for your build with a summary, linked partner builds,
              and detailed description.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Summary Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="summary">Summary</Label>
                {summary.length > SUMMARY_WARNING_THRESHOLD && (
                  <span
                    className={cn(
                      "text-xs",
                      summary.length > SUMMARY_MAX_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {summary.length}/{SUMMARY_MAX_LENGTH}
                  </span>
                )}
              </div>
              <Textarea
                id="summary"
                placeholder="Brief description of this build (optional)..."
                value={summary}
                onChange={(e) =>
                  setSummary(e.target.value.slice(0, SUMMARY_MAX_LENGTH))
                }
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Partner Builds Section */}
            <div className="space-y-2">
              <Label>Partner Builds</Label>
              <PartnerBuildSelector
                currentBuildId={buildId}
                selectedBuilds={partnerBuilds}
                availableBuilds={availableBuilds}
                onAdd={handleAddPartner}
                onRemove={handleRemovePartner}
              />
            </div>

            {/* Description Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <div className="flex items-center border rounded-md overflow-hidden">
                  <Button
                    type="button"
                    variant={mode === "edit" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none h-7 px-3"
                    onClick={() => handleModeSwitch("edit")}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "preview" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none h-7 px-3"
                    onClick={() => handleModeSwitch("preview")}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Preview
                  </Button>
                </div>
              </div>

              {mode === "edit" ? (
                <div className="space-y-2">
                  {/* Toolbar */}
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-1 p-1 border rounded-md bg-muted/30">
                      {toolbarButtons.map((button) => (
                        <Tooltip key={button.label}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={button.action}
                            >
                              <button.icon className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            {button.label}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>

                  <Textarea
                    ref={descriptionRef}
                    placeholder="Write your guide in markdown... (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={12}
                    className="font-mono text-sm resize-none"
                  />
                </div>
              ) : (
                <div className="min-h-[300px] p-4 border rounded-md bg-muted/10">
                  {description ? (
                    <GuideReader content={description} />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No content to preview.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Changes Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close without
              saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingClose(false)}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
