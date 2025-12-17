"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pen } from "lucide-react";
import { GuideReader } from "@/components/guides/guide-reader";
import { GuideEditorDialog } from "@/components/build-editor/guide-editor-dialog";
import { Button } from "@/components/ui/button";
import { updateBuildGuideAction } from "@/app/actions/builds";

interface BuildGuideSectionProps {
    buildId: string;
    initialContent: any;
    updatedAt?: Date;
    isOwner: boolean;
}

export function BuildGuideSection({
    buildId,
    initialContent,
    updatedAt,
    isOwner,
}: BuildGuideSectionProps) {
    const router = useRouter();
    const [content, setContent] = useState<any>(initialContent);
    const [lastUpdated, setLastUpdated] = useState<Date | undefined>(updatedAt);
    const [key, setKey] = useState(0); // Force re-render of editor

    const handleSave = async (payload: { guide: string }) => {
        try {
            const result = await updateBuildGuideAction(buildId, payload.guide);
            if (result.success && result.build?.buildGuide) {
                // Parse the new content to update the view immediately
                const newContent = typeof result.build.buildGuide.content === 'string'
                    ? JSON.parse(result.build.buildGuide.content)
                    : result.build.buildGuide.content;

                setContent(newContent);
                setLastUpdated(new Date()); // Optimistic update
                setKey(prev => prev + 1); // Force re-render if needed

                router.refresh();
            }
        } catch (error) {
            console.error("Failed to save guide:", error);
        }
    };

    if (!content && !isOwner) return null;

    return (
        <div className="container pb-4">
            <div className="bg-card/50 border rounded-xl overflow-hidden">
                <div className="border-b bg-muted/30 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold">Build Guide</h2>
                        {isOwner && (
                            <GuideEditorDialog
                                key={`edit-${key}`} // Force fresh state on re-open
                                buildId={buildId}
                                initialGuide={content ? JSON.stringify(content) : null}
                                onSaved={handleSave}
                                trigger={
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background">
                                        <Pen className="w-4 h-4" />
                                        <span className="sr-only">Edit Guide</span>
                                    </Button>
                                }
                            />
                        )}
                    </div>
                    {lastUpdated && (
                        <span className="text-xs text-muted-foreground">
                            Last updated {lastUpdated.toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div className="p-6">
                    {content ? (
                        <GuideReader content={content} />
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No guide written yet.</p>
                            {isOwner && (
                                <p className="text-sm mt-2">Click the edit button above to start writing.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
