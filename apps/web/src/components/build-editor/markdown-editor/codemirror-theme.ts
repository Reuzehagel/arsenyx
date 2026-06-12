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
  // Tooltips (the `[[` ref autocomplete) otherwise fall back to CM's default
  // light theme — a white box that's unreadable in dark mode. Mirror the
  // site's popover tokens instead.
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-geist-mono)",
    fontSize: "0.8125rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "0.25rem 0.5rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionDetail": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
    marginLeft: "0.5rem",
  },
  ".cm-completionMatchedText": {
    textDecoration: "none",
    color: "var(--primary)",
    fontWeight: "600",
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
