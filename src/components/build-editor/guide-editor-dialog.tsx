"use client";

import { useState, useEffect, useCallback } from "react";
import { SerializedEditorState } from "lexical";
import { BookOpen, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Editor } from "@/components/blocks/editor-x/editor";

// Empty initial state for the editor
const createEmptyEditorState = (): SerializedEditorState =>
    ({
        root: {
            children: [
                {
                    children: [],
                    direction: null,
                    format: "",
                    indent: 0,
                    type: "paragraph",
                    version: 1,
                },
            ],
            direction: null,
            format: "",
            indent: 0,
            type: "root",
            version: 1,
        },
    }) as unknown as SerializedEditorState;

// Parse stored content (JSON string) to SerializedEditorState
const parseEditorState = (content: string | null | undefined): SerializedEditorState => {
    if (!content) return createEmptyEditorState();
    try {
        return JSON.parse(content) as SerializedEditorState;
    } catch {
        return createEmptyEditorState();
    }
};

// Stringify editor state for storage
const stringifyEditorState = (state: SerializedEditorState): string => {
    return JSON.stringify(state);
};

interface GuideEditorDialogProps {
    buildId: string;
    initialGuide?: string | null;
    onSaved?: (payload: { guide: string }) => void | Promise<void>;
    trigger?: React.ReactNode;
}

export function GuideEditorDialog({
    buildId,
    initialGuide,
    onSaved,
    trigger,
}: GuideEditorDialogProps) {
    const [open, setOpen] = useState(false);
    const [guideValue, setGuideValue] = useState<SerializedEditorState>(() =>
        parseEditorState(initialGuide)
    );
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

    // Reset editor state when dialog opens or initial values change
    useEffect(() => {
        if (open) {
            setGuideValue(parseEditorState(initialGuide));
            setSaveStatus("idle");
        }
    }, [open, initialGuide]);

    // Handle save
    const handleSave = useCallback(async () => {
        setIsSaving(true);
        setSaveStatus("idle");

        try {
            const guideString = stringifyEditorState(guideValue);

            // For now, we'll save to localStorage since we don't have a backend yet
            // In a real implementation, this would call an API endpoint
            const storageKey = `arsenix_build_guide_${buildId}`;
            localStorage.setItem(storageKey, guideString);

            // Call the onSaved callback if provided
            if (onSaved) {
                await onSaved({ guide: guideString });
            }

            setSaveStatus("saved");

            // Close dialog after short delay to show success state
            setTimeout(() => {
                setOpen(false);
            }, 500);
        } catch (error) {
            console.error("Failed to save guide:", error);
            setSaveStatus("error");
        } finally {
            setIsSaving(false);
        }
    }, [buildId, guideValue, onSaved]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <BookOpen className="w-4 h-4" />
                        Guide
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1200px] w-[95vw] max-h-[95vh] flex flex-col" showCloseButton={false}>
                {/* Custom top-right action buttons */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    {saveStatus === "saved" && (
                        <span className="text-sm text-green-600 dark:text-green-400 mr-2">
                            ✓ Saved
                        </span>
                    )}
                    {saveStatus === "error" && (
                        <span className="text-sm text-destructive mr-2">
                            Error
                        </span>
                    )}
                    <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleSave}
                        disabled={isSaving}
                        title="Save guide"
                    >
                        <Save className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-70 hover:opacity-100"
                        onClick={() => setOpen(false)}
                        disabled={isSaving}
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <DialogHeader className="pr-24">
                    <DialogTitle>Build Guide</DialogTitle>
                    <DialogDescription>
                        Write a guide for your build. Explain your mod choices,
                        playstyle tips, and any other useful information.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 mt-4 overflow-hidden">
                    <div className="h-[600px] overflow-auto">
                        <Editor
                            key={`guide-${open}`}
                            editorSerializedState={guideValue}
                            onSerializedChange={setGuideValue}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
