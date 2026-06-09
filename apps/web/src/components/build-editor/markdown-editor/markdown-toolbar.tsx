import { type EditorView } from "@codemirror/view"
import {
  Bold,
  Code,
  Columns2,
  Eye,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pencil,
  Quote,
  SquareCode,
  Strikethrough,
  Video,
} from "lucide-react"
import { memo } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { type ActiveFormat } from "./markdown-active"
import {
  insertCodeBlock,
  insertImage,
  insertLink,
  insertVideo,
  setHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleQuote,
  toggleWrap,
} from "./markdown-commands"
import { TemplateMenu } from "./template-menu"

export type ViewMode = "write" | "split" | "preview"

// Shared highlight for a toolbar control whose format is active at the caret.
const ACTIVE_CLASS = "data-active:bg-muted data-active:text-foreground"

function ToolbarButton({
  label,
  active,
  onRun,
  children,
}: {
  label: string
  active?: boolean
  onRun: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            data-active={active ? "" : undefined}
            className={ACTIVE_CLASS}
            // Keep focus (and thus the selection) in the editor on click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRun}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <div className="bg-border mx-0.5 h-5 w-px shrink-0" aria-hidden />
}

export const MarkdownToolbar = memo(function MarkdownToolbar({
  getView,
  getValue,
  viewMode,
  onViewModeChange,
  active,
}: {
  getView: () => EditorView | null
  getValue: () => string
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  active: Set<ActiveFormat>
}) {
  const run = (fn: (view: EditorView) => void) => () => {
    const view = getView()
    if (view) fn(view)
  }
  const headingActive = active.has("h1") || active.has("h2") || active.has("h3")

  return (
    <TooltipProvider>
      <div className="border-input bg-muted/30 flex flex-wrap items-center gap-0.5 rounded-lg border p-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Heading"
                data-active={headingActive ? "" : undefined}
                className={ACTIVE_CLASS}
              />
            }
          >
            <Heading />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={run((v) => setHeading(v, 1))}>
              <Heading1 />
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem onClick={run((v) => setHeading(v, 2))}>
              <Heading2 />
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem onClick={run((v) => setHeading(v, 3))}>
              <Heading3 />
              Heading 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Divider />

        <ToolbarButton
          label="Bold"
          active={active.has("bold")}
          onRun={run((v) => toggleWrap(v, "**", "bold"))}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={active.has("italic")}
          onRun={run((v) => toggleWrap(v, "_", "italic"))}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={active.has("strike")}
          onRun={run((v) => toggleWrap(v, "~~", "strikethrough"))}
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={active.has("code")}
          onRun={run((v) => toggleWrap(v, "`", "code"))}
        >
          <Code />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Bullet list"
          active={active.has("ul")}
          onRun={run(toggleBulletList)}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={active.has("ol")}
          onRun={run(toggleOrderedList)}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={active.has("quote")}
          onRun={run(toggleQuote)}
        >
          <Quote />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Link"
          active={active.has("link")}
          onRun={run(insertLink)}
        >
          <Link2 />
        </ToolbarButton>
        <ToolbarButton label="Image" onRun={run(insertImage)}>
          <Image />
        </ToolbarButton>
        <ToolbarButton label="Embed video" onRun={run(insertVideo)}>
          <Video />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          active={active.has("codeblock")}
          onRun={run(insertCodeBlock)}
        >
          <SquareCode />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1">
          <TemplateMenu getView={getView} getValue={getValue} />
          {/* Segmented Write / Split / Preview control. */}
          <ToggleGroup
            spacing={0}
            variant="outline"
            value={[viewMode]}
            onValueChange={(next: string[]) => {
              const mode = next[0] as ViewMode | undefined
              if (mode) onViewModeChange(mode)
            }}
          >
            <ToggleGroupItem value="write" size="sm" aria-label="Write">
              <Pencil />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="split"
              size="sm"
              aria-label="Split"
              className="hidden sm:inline-flex"
            >
              <Columns2 />
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" size="sm" aria-label="Preview">
              <Eye />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </TooltipProvider>
  )
})
