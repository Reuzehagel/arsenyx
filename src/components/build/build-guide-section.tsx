"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pen } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const GuideReader = dynamic(
  () => import("@/components/guides/guide-reader").then((mod) => mod.GuideReader),
  { ssr: false, loading: () => <div className="h-[100px] rounded-md border bg-muted/30 animate-pulse" /> }
);
import {
  GuideEditor,
  type GuideEditorData,
} from "@/components/build-editor/guide-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PartnerBuildsSection } from "@/components/build/partner-builds-section";
import { Button } from "@/components/ui/button";
import {
  updateBuildGuideAction,
  getUserBuildsForPartnerSelectorAction,
} from "@/app/actions/builds";
import type { PartnerBuildOption } from "@/components/build-editor/partner-build-selector";
import type { PartnerBuild } from "@/components/build-editor/partner-build-card";
import type { VisiblePartnerBuild } from "@/components/build/partner-builds-section";

interface BuildGuideSectionProps {
  buildId: string;
  initialSummary?: string | null;
  initialDescription?: string | null;
  initialPartnerBuilds?: VisiblePartnerBuild[];
  updatedAt?: Date;
  isOwner: boolean;
}

export function BuildGuideSection({
  buildId,
  initialSummary,
  initialDescription,
  initialPartnerBuilds = [],
  updatedAt,
  isOwner,
}: BuildGuideSectionProps) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary ?? null);
  const [description, setDescription] = useState(initialDescription ?? null);
  const [partnerBuilds, setPartnerBuilds] =
    useState<VisiblePartnerBuild[]>(initialPartnerBuilds);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(updatedAt);
  const [key, setKey] = useState(0);
  const [availableBuilds, setAvailableBuilds] = useState<PartnerBuildOption[]>(
    []
  );

  // Load available builds for the editor
  useEffect(() => {
    if (isOwner) {
      getUserBuildsForPartnerSelectorAction().then((result) => {
        if (result.success && result.data) {
          setAvailableBuilds(result.data);
        }
      });
    }
  }, [isOwner]);

  const handleSave = async (data: GuideEditorData) => {
    // Optimistic update
    setSummary(data.summary || null);
    setDescription(data.description || null);
    setLastUpdated(new Date());
    setKey((prev) => prev + 1);

    // Update partner builds from available builds
    const newPartnerBuilds = data.partnerBuildIds
      .map((id) => {
        const build = availableBuilds.find((b) => b.id === id);
        if (!build) return null;
        return {
          id: build.id,
          slug: build.slug,
          name: build.name,
          item: build.item,
          buildData: { formaCount: build.buildData.formaCount },
        } as VisiblePartnerBuild;
      })
      .filter((b): b is VisiblePartnerBuild => b !== null);
    setPartnerBuilds(newPartnerBuilds);

    // Background save
    const result = await updateBuildGuideAction(buildId, {
      summary: data.summary,
      description: data.description,
      partnerBuildIds: data.partnerBuildIds,
    });

    if (result.success) {
      router.refresh();
    } else {
      toast.error(result.error || "Failed to save guide");
    }
  };

  const hasContent = summary || description || partnerBuilds.length > 0;

  if (!hasContent && !isOwner) return null;

  // Convert partner builds to the format expected by editor
  const partnerBuildsForEditor: PartnerBuild[] = partnerBuilds
    .filter((b) => !b.isDeleted && b.item && b.buildData)
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      item: b.item!,
      buildData: b.buildData!,
    }));

  return (
    <div className="container pb-4">
      <div className="bg-card/50 border rounded-xl overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Build Guide</h2>
            {isOwner && (
              <Dialog>
                <DialogTrigger render={<Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-background"
                  />}>
                    <Pen className="size-4" />
                    <span className="sr-only">Edit Guide</span>
                </DialogTrigger>
                <DialogContent
                  key={`edit-${key}`}
                  className="sm:max-w-[900px] w-[95vw] max-h-[95vh] flex flex-col"
                >
                  <DialogHeader>
                    <DialogTitle>Build Guide</DialogTitle>
                    <DialogDescription>
                      Write a guide for your build with a summary, linked partner builds,
                      and detailed description.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto pr-2">
                    <GuideEditor
                      buildId={buildId}
                      initialSummary={summary}
                      initialDescription={description}
                      initialPartnerBuilds={partnerBuildsForEditor}
                      availableBuilds={availableBuilds}
                      onSave={handleSave}
                      showPartnerBuilds={true}
                      showSaveButtons={true}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Last updated {lastUpdated.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>
        <div className="p-6 flex flex-col gap-6">
          {hasContent ? (
            <>
              {/* Summary */}
              {summary && (
                <div className="text-muted-foreground">{summary}</div>
              )}

              {/* Description */}
              {description && (
                <GuideReader key={lastUpdated?.toISOString()} content={description} />
              )}

              {/* Partner Builds */}
              {partnerBuilds.length > 0 && (
                <PartnerBuildsSection partnerBuilds={partnerBuilds} />
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No guide written yet.</p>
              {isOwner && (
                <p className="text-sm mt-2">
                  Click the edit button above to start writing.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
