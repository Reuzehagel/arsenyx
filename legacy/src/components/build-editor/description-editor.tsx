"use client"

import {
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  List,
  Eye,
  Pencil,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useState, useRef, useCallback } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const MarkdownReader = dynamic(
  () =>
    import("@/components/build/markdown-reader").then(
      (mod) => mod.MarkdownReader,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] rounded-md" />,
  },
)

interface DescriptionEditorProps {
  description: string
  onDescriptionChange: (description: string) => void
  rows?: number
  toolbarSize?: "sm" | "md"
  previewMinHeight?: string
}

export function DescriptionEditor({
  description,
  onDescriptionChange,
  rows = 20,
  toolbarSize = "md",
  previewMinHeight = "min-h-[300px]",
}: DescriptionEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const insertMarkdown = useCallback(
    (before: string, after: string, placeholder: string) => {
      const textarea = descriptionRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = description
      const selectedText = text.substring(start, end)

      const insertText = selectedText || placeholder
      const newText =
        text.substring(0, start) +
        before +
        insertText +
        after +
        text.substring(end)

      onDescriptionChange(newText)

      setTimeout(() => {
        textarea.focus()
        if (selectedText) {
          textarea.setSelectionRange(
            start + before.length,
            start + before.length + selectedText.length,
          )
        } else {
          textarea.setSelectionRange(
            start + before.length,
            start + before.length + placeholder.length,
          )
        }
      }, 0)
    },
    [description, onDescriptionChange],
  )

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
  ]

  const toolbarClass = toolbarSize === "sm" ? "h-6 w-6" : "h-7 w-7"
  const toolbarButtonPaddingClass = toolbarSize === "sm" ? "px-2" : "px-3"
  const toolbarButtonHeightClass = toolbarSize === "sm" ? "h-6" : "h-7"
  const buttonTextSizeClass = toolbarSize === "sm" ? "text-xs" : ""

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center overflow-hidden rounded-md border">
          <Button
            type="button"
            variant={mode === "edit" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "rounded-none",
              toolbarButtonHeightClass,
              toolbarButtonPaddingClass,
              buttonTextSizeClass,
            )}
            onClick={() => setMode("edit")}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "rounded-none",
              toolbarButtonHeightClass,
              toolbarButtonPaddingClass,
              buttonTextSizeClass,
            )}
            onClick={() => setMode("preview")}
          >
            <Eye data-icon="inline-start" />
            Preview
          </Button>
        </div>
      </div>

      {mode === "edit" ? (
        <div className="flex flex-col gap-2">
          {/* Toolbar */}
          <TooltipProvider delay={300}>
            <div className="bg-muted/30 flex items-center gap-1 rounded-md border p-1">
              {/* eslint-disable-next-line react-hooks/refs -- ref accessed only inside click handlers, not during render */}
              {toolbarButtons.map((button) => (
                <Tooltip key={button.label}>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={toolbarClass}
                        onClick={button.action}
                      />
                    }
                  >
                    <button.icon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{button.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <Textarea
            ref={descriptionRef}
            placeholder="Write your guide in markdown… (optional)"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={rows}
            className="resize-none font-mono text-sm"
          />
        </div>
      ) : (
        <div
          className={cn("bg-muted/10 rounded-md border p-4", previewMinHeight)}
        >
          {description ? (
            <MarkdownReader content={description} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No content to preview.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
