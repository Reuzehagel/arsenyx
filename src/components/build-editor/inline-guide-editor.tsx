"use client";

import { useState, useRef, useCallback } from "react";
import {
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GuideReader } from "@/components/guides/guide-reader";

const SUMMARY_MAX_LENGTH = 400;
const SUMMARY_WARNING_THRESHOLD = 300;

export interface InlineGuideData {
  summary: string;
  description: string;
}

interface InlineGuideEditorProps {
  summary: string;
  description: string;
  onSummaryChange: (summary: string) => void;
  onDescriptionChange: (description: string) => void;
}

export function InlineGuideEditor({
  summary,
  description,
  onSummaryChange,
  onDescriptionChange,
}: InlineGuideEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Markdown toolbar helper - wrapped in useCallback to avoid ref access during render analysis
  const insertMarkdown = useCallback(
    (before: string, after: string, placeholder: string) => {
      const textarea = descriptionRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = description;
      const selectedText = text.substring(start, end);

      const insertText = selectedText || placeholder;
      const newText =
        text.substring(0, start) +
        before +
        insertText +
        after +
        text.substring(end);

      onDescriptionChange(newText);

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
    },
    [description, onDescriptionChange]
  );

  // Toolbar button handlers
  const handleBold = useCallback(
    () => insertMarkdown("**", "**", "bold text"),
    [insertMarkdown]
  );
  const handleItalic = useCallback(
    () => insertMarkdown("*", "*", "italic text"),
    [insertMarkdown]
  );
  const handleHeading = useCallback(
    () => insertMarkdown("\n## ", "\n", "Heading"),
    [insertMarkdown]
  );
  const handleLink = useCallback(
    () => insertMarkdown("[", "](url)", "link text"),
    [insertMarkdown]
  );
  const handleList = useCallback(
    () => insertMarkdown("\n- ", "\n", "list item"),
    [insertMarkdown]
  );

  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="guide-summary" className="text-sm">
            Summary
          </Label>
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
          id="guide-summary"
          placeholder="Brief description of this build (optional)..."
          value={summary}
          onChange={(e) =>
            onSummaryChange(e.target.value.slice(0, SUMMARY_MAX_LENGTH))
          }
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Description Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Description</Label>
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              type="button"
              variant={mode === "edit" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-6 px-2 text-xs"
              onClick={() => setMode("edit")}
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              type="button"
              variant={mode === "preview" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-6 px-2 text-xs"
              onClick={() => setMode("preview")}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleBold}
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Bold</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleItalic}
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Italic</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleHeading}
                    >
                      <Heading2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Heading</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleLink}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Link</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleList}
                    >
                      <List className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">List</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            <Textarea
              ref={descriptionRef}
              placeholder="Write your guide in markdown... (optional)"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={20}
              className="font-mono text-sm resize-none"
            />
          </div>
        ) : (
          <div className="min-h-[200px] p-4 border rounded-md bg-muted/10">
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
  );
}
