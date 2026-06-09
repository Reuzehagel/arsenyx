import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { EditorView } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

/**
 * CodeMirror theme wired to the site's design tokens. Colours are CSS
 * custom properties (see styles/globals.css), so the editor tracks
 * light/dark automatically with no second theme to maintain. Font and
 * ligature handling mirror the old markdown <textarea> it replaces.
 */
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--foreground)",
    backgroundColor: "transparent",
    fontSize: "0.875rem",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-geist-mono)",
    fontVariantLigatures: "none",
    lineHeight: "1.65",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "0.625rem 0",
    caretColor: "var(--foreground)",
  },
  ".cm-line": { padding: "0 0.75rem" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
    borderLeftWidth: "1.5px",
  },
  // CM paints its own selection layer; the native ::selection rule never
  // applies, so both the layer and the focused variant are styled here.
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--primary) 22%, transparent)",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  // Absolute + nowrap keeps the placeholder out of layout flow: in an empty
  // doc it's the only thing on the first line, and if it wrapped it would
  // inflate the line box (and the text caret) to its full height.
  ".cm-placeholder": {
    position: "absolute",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)",
  },
})

/**
 * Markdown token styling. Kept monochrome to match the site's grayscale
 * palette: links/headings lean on `--primary` (near-foreground), structural
 * marks fade to `--muted-foreground`. Source highlighting only — it never
 * touches the persisted text, so custom syntax (`url|240`, bare video URLs)
 * passes through untouched, just without bespoke colour.
 */
const markdownHighlight = HighlightStyle.define([
  {
    tag: t.heading1,
    fontWeight: "700",
    fontSize: "1.2em",
    color: "var(--foreground)",
  },
  {
    tag: t.heading2,
    fontWeight: "700",
    fontSize: "1.1em",
    color: "var(--foreground)",
  },
  {
    tag: [t.heading3, t.heading4, t.heading5, t.heading6],
    fontWeight: "600",
    color: "var(--foreground)",
  },
  { tag: t.strong, fontWeight: "700", color: "var(--foreground)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--primary)", fontWeight: "500" },
  { tag: t.url, color: "var(--muted-foreground)", textDecoration: "underline" },
  { tag: t.monospace, color: "var(--muted-foreground)" },
  { tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [t.list, t.processingInstruction], color: "var(--muted-foreground)" },
  { tag: t.meta, color: "var(--muted-foreground)" },
])

export const arsenyxEditorTheme = [
  editorTheme,
  syntaxHighlighting(markdownHighlight),
]
