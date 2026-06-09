import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { indentUnit } from "@codemirror/language"
import { EditorState, Prec } from "@codemirror/state"
import { EditorView, keymap, placeholder } from "@codemirror/view"
import { useEffect, useRef } from "react"

import { arsenyxEditorTheme } from "./codemirror-theme"
import { markdownFormatKeymap, pasteLinkHandler } from "./markdown-commands"

/**
 * Mounts a raw CodeMirror 6 instance and keeps it in sync with React state.
 *
 * Deliberately *not* using the @uiw wrapper: under Bun workspaces its
 * dep + peerDep listing of @codemirror/* risks duplicate state/view copies
 * (CM6's "two instances" crash). A ~40-line hook over the primitives sidesteps
 * that and keeps the dependency surface to first-party @codemirror packages.
 *
 * The view is created once. `onChange` is read through a ref so a new callback
 * identity each render doesn't tear down and rebuild the editor. External
 * `value` changes (draft restore, programmatic resets) are reconciled by
 * replacing the doc only when it actually differs — normal typing is a no-op
 * here, so the cursor never jumps.
 */
export function useCodeMirror(opts: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoFocus?: boolean
  viewRef: React.RefObject<EditorView | null>
  onReady?: () => void
  /** Fires on cursor/selection or doc changes — drives active toolbar state. */
  onStateChange?: (state: EditorView["state"]) => void
  /** Fires on editor scroll — drives split-view scroll sync. */
  onScroll?: (scroller: HTMLElement) => void
}) {
  const { value, placeholder: ph, autoFocus, viewRef, onReady } = opts
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(opts.onChange)
  onChangeRef.current = opts.onChange
  const onStateChangeRef = useRef(opts.onStateChange)
  onStateChangeRef.current = opts.onStateChange
  const onScrollRef = useRef(opts.onScroll)
  onScrollRef.current = opts.onScroll

  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return

    const view = new EditorView({
      doc: value,
      parent,
      extensions: [
        history(),
        markdown({ base: markdownLanguage }),
        arsenyxEditorTheme,
        EditorView.lineWrapping,
        EditorState.allowMultipleSelections.of(true),
        indentUnit.of("  "),
        // Format shortcuts and list auto-continue win over the defaults.
        Prec.high(keymap.of(markdownFormatKeymap)),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        placeholder(ph),
        EditorView.domEventHandlers({ paste: pasteLinkHandler }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
          if (update.docChanged || update.selectionSet) {
            onStateChangeRef.current?.(update.state)
          }
        }),
      ],
    })
    viewRef.current = view
    if (autoFocus) view.focus()
    onStateChangeRef.current?.(view.state)
    onReady?.()

    const scroller = view.scrollDOM
    const handleScroll = () => onScrollRef.current?.(scroller)
    scroller.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      scroller.removeEventListener("scroll", handleScroll)
      view.destroy()
      viewRef.current = null
    }
    // Create once. value/autoFocus/ph are read at mount; later `value` changes
    // are handled by the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value === current) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return containerRef
}
