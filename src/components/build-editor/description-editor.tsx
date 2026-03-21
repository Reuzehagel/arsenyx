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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dynamic from "next/dynamic";

const GuideReader = dynamic(
  () => import("@/components/guides/guide-reader").then((mod) => mod.GuideReader),
  { ssr: false, loading: () => <div className="h-[200px] rounded-md border bg-muted/30 animate-pulse" /> }
);

interface DescriptionEditorProps {
  description: string;
  onDescriptionChange: (description: string) => void;
  rows?: number;
  toolbarSize?: "sm" | "md";
  previewMinHeight?: string;
}

export function DescriptionEditor({
  description,
  onDescriptionChange,
  rows = 20,
  toolbarSize = "md",
  previewMinHeight = "min-h-[300px]",
}: DescriptionEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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

  const toolbarClass =
    toolbarSize === "sm" ? "h-6 w-6" : "h-7 w-7";
  const toolbarButtonPaddingClass = toolbarSize === "sm" ? "px-2" : "px-3";
  const toolbarButtonHeightClass = toolbarSize === "sm" ? "h-6" : "h-7";
  const buttonTextSizeClass = toolbarSize === "sm" ? "text-xs" : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            type="button"
            variant={mode === "edit" ? "default" : "ghost"}
            size="sm"
            className={cn("rounded-none", toolbarButtonHeightClass, toolbarButtonPaddingClass, buttonTextSizeClass)}
            onClick={() => setMode("edit")}
          >
            <Pencil className="size-3 mr-1" />
            Edit
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "default" : "ghost"}
            size="sm"
            className={cn("rounded-none", toolbarButtonHeightClass, toolbarButtonPaddingClass, buttonTextSizeClass)}
            onClick={() => setMode("preview")}
          >
            <Eye className="size-3 mr-1" />
            Preview
          </Button>
        </div>
      </div>

      {mode === "edit" ? (
        <div className="flex flex-col gap-2">
          {/* Toolbar */}
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1 p-1 border rounded-md bg-muted/30">
              {/* eslint-disable-next-line react-hooks/refs -- ref accessed only inside click handlers, not during render */}
              {toolbarButtons.map((button) => (
                <Tooltip key={button.label}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={toolbarClass}
                      onClick={button.action}
                    >
                      <button.icon className="size-4" />
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
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={rows}
            className="font-mono text-sm resize-none"
          />
        </div>
      ) : (
        <div className={cn("p-4 border rounded-md bg-muted/10", previewMinHeight)}>
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
  );
}
