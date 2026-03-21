"use client";

import Image from "next/image";
import { Diamond, Gem, Loader2, Pencil, Save, UploadCloud, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getImageUrl } from "@/lib/warframe/images";
import { PublishDialog, type Visibility } from "./publish-dialog";

export interface BuildEditorHeaderProps {
  item: { name: string; imageName?: string };
  categoryLabel: string;
  totalEndoCost: number;
  formaCount: number;
  isOwner: boolean;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  savedBuildId?: string;
  canEdit: boolean;
  isAuthenticated: boolean;
  buildName: string;
  setBuildName: (name: string) => void;
  buildId: string | undefined;
  saveStatus: "idle" | "saving" | "saved" | "error";
  publishDialogOpen: boolean;
  setPublishDialogOpen: (open: boolean) => void;
  handlePublish: (visibility: Visibility) => Promise<void>;
  handleCancel: () => void;
  handleCopyBuild: () => Promise<void>;
  showCopied: boolean;
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
  return (
    <>
      {/* Header Card */}
      <div className="bg-card border rounded-lg p-4 mb-4">
        <div className="flex flex-col gap-4 md:flex-row md:gap-4 md:items-center md:justify-between">
          <div className="flex gap-4 items-center">
            <div className="relative size-16 md:w-24 md:h-24 bg-muted/10 rounded-md flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src={getImageUrl(item.imageName)}
                alt={item.name}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                {item.name}
              </h1>
              <span className="text-sm text-muted-foreground">
                {categoryLabel}
              </span>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 font-semibold text-xs bg-muted/50 hover:bg-muted">
                  <Diamond className="size-3 fill-current" />
                  {totalEndoCost.toLocaleString()}
                </Badge>
                {formaCount > 0 && (
                  <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 font-semibold text-xs bg-muted/50 hover:bg-muted">
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
              <Button variant="default" size="sm" className="gap-2" onClick={() => setIsEditMode(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            </div>
          )}
          {/* Editing controls */}
          {canEdit && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              {isAuthenticated && (
                <Input value={buildName} onChange={(e) => setBuildName(e.target.value)} placeholder="Build name..." className="w-full sm:w-48 h-8 text-sm" />
              )}
              <div className="flex gap-2">
                {isAuthenticated ? (
                  <Button variant="default" size="sm" className="gap-2 flex-1 sm:flex-initial" onClick={() => setPublishDialogOpen(true)} disabled={saveStatus === "saving"}>
                    {saveStatus === "saving" ? (<Loader2 className="size-4 animate-spin" />) : buildId ? (<Save className="size-4" />) : (<UploadCloud className="size-4" />)}
                    <span className="hidden sm:inline">
                      {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error" : buildId ? "Update" : "Publish"}
                    </span>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-initial" onClick={handleCopyBuild}>
                    <Save className="size-4" />
                    <span className="hidden sm:inline">{showCopied ? "Copied!" : "Copy Link"}</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCancel}>
                  <X className="size-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
              </div>
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
  );
}
