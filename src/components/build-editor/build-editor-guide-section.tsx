"use client"

import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"

const GuideEditor = dynamic(
  () => import("./guide-editor").then((mod) => mod.GuideEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] rounded-md" />,
  },
)

const MarkdownReader = dynamic(
  () =>
    import("@/components/build/markdown-reader").then(
      (mod) => mod.MarkdownReader,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[100px] rounded-md" />,
  },
)
import { PartnerBuildsSection } from "@/components/build/partner-builds-section"

import type { PartnerBuild } from "./partner-build-card"
import type { PartnerBuildOption } from "./partner-build-selector"

export interface BuildEditorGuideSectionProps {
  canEdit: boolean
  savedBuildId?: string
  isAuthenticated: boolean
  guideSummary: string
  setGuideSummary: (v: string) => void
  guideDescription: string
  setGuideDescription: (v: string) => void
  partnerBuilds: PartnerBuild[]
  availableBuilds: PartnerBuildOption[]
}

export function BuildEditorGuideSection({
  canEdit,
  savedBuildId,
  isAuthenticated,
  guideSummary,
  setGuideSummary,
  guideDescription,
  setGuideDescription,
  partnerBuilds,
  availableBuilds,
}: BuildEditorGuideSectionProps) {
  return (
    <>
      {/* Build Guide - New builds */}
      {canEdit && !savedBuildId && (
        <div className="bg-card/50 overflow-hidden rounded-xl border">
          <div className="bg-muted/30 border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Build Guide</h2>
          </div>
          <div className="flex flex-col gap-6 p-6">
            <GuideEditor
              buildId=""
              initialSummary={guideSummary}
              initialDescription={guideDescription}
              onSummaryChange={setGuideSummary}
              onDescriptionChange={setGuideDescription}
              initialPartnerBuilds={partnerBuilds as PartnerBuild[]}
              availableBuilds={availableBuilds}
              showPartnerBuilds={isAuthenticated}
              showSaveButtons={false}
            />
            <p className="text-muted-foreground text-xs">
              Your guide will be saved when you publish the build.
            </p>
          </div>
        </div>
      )}

      {/* Build Guide - Existing builds */}
      {savedBuildId && (
        <div className="bg-card/50 overflow-hidden rounded-xl border">
          <div className="bg-muted/30 flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Build Guide</h2>
          </div>
          <div className="flex flex-col gap-6 p-6">
            {canEdit ? (
              <GuideEditor
                buildId={savedBuildId}
                initialSummary={guideSummary}
                initialDescription={guideDescription}
                onSummaryChange={setGuideSummary}
                onDescriptionChange={setGuideDescription}
                initialPartnerBuilds={partnerBuilds as PartnerBuild[]}
                availableBuilds={availableBuilds}
                showPartnerBuilds={true}
                showSaveButtons={false}
              />
            ) : (
              <>
                {guideSummary ||
                guideDescription ||
                partnerBuilds.length > 0 ? (
                  <>
                    {guideSummary && (
                      <div className="text-muted-foreground">
                        {guideSummary}
                      </div>
                    )}
                    {guideDescription && (
                      <MarkdownReader content={guideDescription} />
                    )}
                    {partnerBuilds.length > 0 && (
                      <PartnerBuildsSection partnerBuilds={partnerBuilds} />
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <p>No guide written yet.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
