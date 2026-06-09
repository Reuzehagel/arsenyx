import { type EditorState } from "@codemirror/state"
import { type EditorView } from "@codemirror/view"
import { memo, useCallback, useEffect, useRef, useState } from "react"

import { MarkdownBody } from "@/components/markdown-body"
import { cn } from "@/lib/util/utils"

import {
  computeActiveFormats,
  sameFormats,
  type ActiveFormat,
} from "./markdown-active"
import { MarkdownToolbar, type ViewMode } from "./markdown-toolbar"
import { useCodeMirror } from "./use-codemirror"

/** Shared prose styling for the live preview — matches the published guide. */
export const PREVIEW_PROSE_CLASS =
  "prose prose-sm dark:prose-invert [&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted [&_blockquote]:border-border [&_blockquote]:text-muted-foreground [&_th]:border-border [&_td]:border-border max-w-none [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol_li]:list-decimal [&_p]:mb-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4"

function CodeEditor({
  value,
  onChange,
  placeholder,
  viewRef,
  onStateChange,
  onScroll,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  viewRef: React.RefObject<EditorView | null>
  onStateChange: (state: EditorState) => void
  onScroll: (scroller: HTMLElement) => void
}) {
  const containerRef = useCodeMirror({
    value,
    onChange,
    placeholder,
    viewRef,
    onStateChange,
    onScroll,
  })
  return <div ref={containerRef} className="h-full min-h-64" />
}

// Memoized so a parent re-render (every keystroke) doesn't re-parse markdown
// when the (debounced) source is unchanged. react-markdown isn't cheap.
const Preview = memo(function Preview({ source }: { source: string }) {
  if (!source.trim()) {
    return (
      <p className="text-muted-foreground p-3 text-sm italic">
        Nothing to preview yet.
      </p>
    )
  }
  return (
    <div className="p-3">
      <MarkdownBody source={source} className={PREVIEW_PROSE_CLASS} />
    </div>
  )
})

/**
 * CodeMirror-backed markdown editor: a discoverable toolbar, an IDE-esque
 * source pane, and a live preview that renders through the same MarkdownBody
 * the published guide uses (so the preview can't drift from reality).
 *
 * Lazy-loaded by GuideEditor — this module pulls in CodeMirror, which stays
 * out of the main route chunk and never reaches the read-only embed bundle.
 *
 * `docKey` remounts the source pane when the edited scope changes (build vs a
 * specific variant), giving each scope a clean undo history instead of letting
 * one scope's edits undo into another.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  docKey,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  docKey?: string
}) {
  const viewRef = useRef<EditorView | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  // Split is the default on a roomy screen; on narrow ones it stacks awkwardly,
  // so start in single-pane write mode there.
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 640px)").matches
      ? "split"
      : "write",
  )
  const [active, setActive] = useState<Set<ActiveFormat>>(() => new Set())
  // The preview lags the editor by a short debounce so a fast typing burst
  // doesn't re-parse markdown on every keystroke (the main jank source). The
  // editor itself stays fully live; the preview catches up on the next pause.
  const [previewSource, setPreviewSource] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setPreviewSource(value), 150)
    return () => window.clearTimeout(id)
  }, [value])
  // Stable accessors so the memoized toolbar doesn't re-render every keystroke
  // just because `value` changed (only TemplateMenu reads it, lazily).
  const valueRef = useRef(value)
  valueRef.current = value
  // Flush the preview immediately on a scope switch (docKey change) so it never
  // renders the previous scope's guide during the debounce window.
  useEffect(() => {
    setPreviewSource(valueRef.current)
  }, [docKey])
  const getView = useCallback(() => viewRef.current, [])
  const getValue = useCallback(() => valueRef.current, [])

  const handleStateChange = (state: EditorState) => {
    const next = computeActiveFormats(state)
    setActive((prev) => (sameFormats(prev, next) ? prev : next))
  }

  // Proportional editor→preview scroll sync for split view. Mapping by scroll
  // ratio (not line) is approximate but cheap and judder-free.
  const handleScroll = (scroller: HTMLElement) => {
    const p = previewRef.current
    if (!p) return
    const max = scroller.scrollHeight - scroller.clientHeight
    const ratio = max > 0 ? scroller.scrollTop / max : 0
    p.scrollTop = ratio * (p.scrollHeight - p.clientHeight)
  }

  const showEditor = viewMode !== "preview"
  const showPreview = viewMode !== "write"
  const isSplit = viewMode === "split"

  return (
    <div className="flex flex-col gap-2">
      <MarkdownToolbar
        getView={getView}
        getValue={getValue}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        active={active}
      />
      <div
        className={cn(
          "border-input grid overflow-hidden rounded-lg border",
          // Split mode bounds the height so each pane scrolls internally (and
          // the editor→preview scroll sync has something to track) — sized to
          // the viewport so it's generous on big screens, capped on small ones.
          // Single-pane modes grow with content instead.
          isSplit
            ? "h-[clamp(28rem,65vh,48rem)] sm:grid-cols-2"
            : "min-h-[28rem]",
        )}
      >
        {/* The editor stays mounted across view-mode switches (hidden, not
            unmounted) so toggling to Preview and back keeps cursor + undo. */}
        <div
          className={cn(
            "min-w-0",
            isSplit && "min-h-0 overflow-hidden",
            !showEditor && "hidden",
          )}
        >
          <CodeEditor
            key={docKey ?? "build"}
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? "Write your build guide in Markdown…"}
            viewRef={viewRef}
            onStateChange={handleStateChange}
            onScroll={handleScroll}
          />
        </div>
        {showPreview ? (
          <div
            ref={previewRef}
            className={cn(
              "bg-muted/15 min-w-0 overflow-auto",
              isSplit && "min-h-0",
              isSplit &&
                showEditor &&
                "border-input border-t sm:border-t-0 sm:border-l",
            )}
          >
            <Preview source={previewSource} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
