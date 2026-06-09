import { EditorSelection, type ChangeSpec } from "@codemirror/state"
import { type EditorView, type KeyBinding } from "@codemirror/view"

// ─── Inline wrapping (bold / italic / code / strikethrough) ─────────────────
//
// Toggles a symmetric marker around each selection range. If the selection is
// already wrapped (marker inside or immediately around it) the marker is
// stripped; otherwise it's added. With an empty selection a placeholder is
// inserted and left selected so the user can type over it.

export function toggleWrap(
  view: EditorView,
  marker: string,
  placeholder: string,
): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to)
    const len = marker.length

    // Marker sits inside the selection: `**bold**` selected whole.
    if (
      text.length >= len * 2 &&
      text.startsWith(marker) &&
      text.endsWith(marker)
    ) {
      const inner = text.slice(len, text.length - len)
      return {
        changes: { from: range.from, to: range.to, insert: inner },
        range: EditorSelection.range(range.from, range.from + inner.length),
      }
    }

    // Marker sits just outside the selection: bold with the `**` not selected.
    const outerBefore = state.sliceDoc(
      Math.max(0, range.from - len),
      range.from,
    )
    const outerAfter = state.sliceDoc(
      range.to,
      Math.min(state.doc.length, range.to + len),
    )
    if (outerBefore === marker && outerAfter === marker) {
      return {
        changes: [
          { from: range.from - len, to: range.from, insert: "" },
          { from: range.to, to: range.to + len, insert: "" },
        ],
        range: EditorSelection.range(range.from - len, range.to - len),
      }
    }

    const content = text || placeholder
    const insert = marker + content + marker
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(
        range.from + len,
        range.from + len + content.length,
      ),
    }
  })
  view.dispatch(
    state.update(tr, { scrollIntoView: true, userEvent: "input.format" }),
  )
  view.focus()
}

// ─── Line-prefix blocks (headings / lists / quote) ──────────────────────────

function selectedLines(view: EditorView) {
  const { state } = view
  const seen = new Set<number>()
  const lines: { from: number; text: string }[] = []
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) {
      if (seen.has(n)) continue
      seen.add(n)
      const line = state.doc.line(n)
      lines.push({ from: line.from, text: line.text })
    }
  }
  return lines.sort((a, b) => a.from - b.from)
}

function applyChanges(view: EditorView, changes: ChangeSpec[]): void {
  if (changes.length === 0) {
    view.focus()
    return
  }
  view.dispatch(view.state.update({ changes, userEvent: "input.format" }))
  view.focus()
}

/** H1–H3. Re-applying the same level on every selected line clears it. */
export function setHeading(view: EditorView, level: 1 | 2 | 3): void {
  const lines = selectedLines(view)
  const hashes = "#".repeat(level) + " "
  const allSame = lines.every((l) => l.text.startsWith(hashes))
  const changes = lines.map((l) => {
    const existing = l.text.match(/^#{1,6} /)?.[0].length ?? 0
    return {
      from: l.from,
      to: l.from + existing,
      insert: allSame ? "" : hashes,
    }
  })
  applyChanges(view, changes)
}

function toggleUniformPrefix(
  view: EditorView,
  match: RegExp,
  prefix: string,
): void {
  const lines = selectedLines(view)
  const allHave = lines.every((l) => match.test(l.text))
  const changes = lines.map((l) => {
    if (allHave) {
      const m = l.text.match(match)!
      return { from: l.from, to: l.from + m[0].length, insert: "" }
    }
    // Strip a conflicting list/quote marker first so toggles swap cleanly.
    const conflict = l.text.match(
      /^(#{1,6} |> |[-*+] \[[ xX]\] |[-*+] |\d+\. )/,
    )
    const stripLen = conflict ? conflict[0].length : 0
    return { from: l.from, to: l.from + stripLen, insert: prefix }
  })
  applyChanges(view, changes)
}

export function toggleBulletList(view: EditorView): void {
  toggleUniformPrefix(view, /^[-*+] /, "- ")
}

export function toggleQuote(view: EditorView): void {
  toggleUniformPrefix(view, /^> /, "> ")
}

/** Ordered list with sequential numbering across the selected lines. */
export function toggleOrderedList(view: EditorView): void {
  const lines = selectedLines(view)
  const allHave = lines.every((l) => /^\d+\. /.test(l.text))
  let n = 1
  const changes = lines.map((l) => {
    if (allHave) {
      const m = l.text.match(/^\d+\. /)!
      return { from: l.from, to: l.from + m[0].length, insert: "" }
    }
    const conflict = l.text.match(/^(#{1,6} |> |[-*+] \[[ xX]\] |[-*+] )/)
    const stripLen = conflict ? conflict[0].length : 0
    return { from: l.from, to: l.from + stripLen, insert: `${n++}. ` }
  })
  applyChanges(view, changes)
}

// ─── Inserts (link / image / code block) ────────────────────────────────────

/** `[text](url)` — cursor lands in the URL when there's a selection to
 *  hyperlink, otherwise selects the `text` placeholder. */
export function insertLink(view: EditorView): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to)
    if (text) {
      const insert = `[${text}](url)`
      const urlStart = range.from + text.length + 3
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(urlStart, urlStart + 3),
      }
    }
    const insert = `[text](url)`
    return {
      changes: { from: range.from, insert },
      range: EditorSelection.range(range.from + 1, range.from + 5),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }))
  view.focus()
}

/** `![alt](url)`. Tip: a `|240` suffix on the URL (e.g. `url|240`) sets a
 *  fixed px display width — see MarkdownBody's parseSizedSrc. */
export function insertImage(view: EditorView): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const alt = state.sliceDoc(range.from, range.to) || "alt"
    const insert = `![${alt}](url)`
    const urlStart = range.from + alt.length + 4
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 3),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }))
  view.focus()
}

/** Fenced code block around the selection (or an empty one). */
export function insertCodeBlock(view: EditorView): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to)
    const body = text || "code"
    const insert = "```\n" + body + "\n```"
    const bodyStart = range.from + 4
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(bodyStart, bodyStart + body.length),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }))
  view.focus()
}

/** Drop a video URL on its own line — MarkdownBody upgrades a bare
 *  YouTube/Vimeo URL paragraph into an embedded player. The placeholder is
 *  left selected so the user can paste their link straight over it. */
export function insertVideo(view: EditorView): void {
  const { state } = view
  const pos = state.selection.main.to
  const line = state.doc.lineAt(pos)
  const placeholder = "https://youtu.be/VIDEO_ID"
  const before = line.from === pos ? "" : "\n\n"
  const insert = before + placeholder + "\n"
  const selFrom = pos + before.length
  view.dispatch(
    state.update({
      changes: { from: pos, insert },
      selection: EditorSelection.range(selFrom, selFrom + placeholder.length),
      scrollIntoView: true,
      userEvent: "input",
    }),
  )
  view.focus()
}

/** Replace the whole document (empty doc) or insert at the cursor. Used by
 *  the template menu. */
export function insertTemplate(view: EditorView, body: string): void {
  const { state } = view
  const isEmpty = state.doc.length === 0
  if (isEmpty) {
    view.dispatch(
      state.update({
        changes: { from: 0, insert: body },
        selection: { anchor: body.length },
        userEvent: "input.template",
      }),
    )
    view.focus()
    return
  }
  const pos = state.selection.main.to
  const line = state.doc.lineAt(pos)
  // Drop the template onto its own line so it never glues to existing prose.
  const prefix = line.from === pos ? "" : "\n\n"
  const insert = prefix + body
  view.dispatch(
    state.update({
      changes: { from: pos, insert },
      selection: { anchor: pos + insert.length },
      scrollIntoView: true,
      userEvent: "input.template",
    }),
  )
  view.focus()
}

// ─── Keymap: list auto-continue + format shortcuts ──────────────────────────

const continueList = (view: EditorView): boolean => {
  const { state } = view
  const range = state.selection.main
  if (!range.empty) return false
  const line = state.doc.lineAt(range.head)
  // Decide empty-vs-continue from the WHOLE line, not just the text before the
  // caret — otherwise pressing Enter right after the marker (with content still
  // to its right) is misread as an empty item and strips the bullet.
  const m = line.text.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )(.*)$/)
  if (!m) return false
  const [, indent, prefix, num, rest] = m

  // Empty item → exit the list by removing its marker.
  if (rest.trim() === "") {
    const markerEnd = line.from + indent.length + prefix.length
    view.dispatch(
      state.update({
        changes: { from: line.from, to: markerEnd, insert: "" },
        selection: { anchor: line.from },
        userEvent: "input",
      }),
    )
    return true
  }

  const nextPrefix = num
    ? `${Number(num) + 1}. `
    : prefix.includes("[")
      ? prefix.replace(/\[[ xX]\]/, "[ ]")
      : prefix
  const insert = "\n" + indent + nextPrefix
  view.dispatch(
    state.update({
      changes: { from: range.head, insert },
      selection: { anchor: range.head + insert.length },
      scrollIntoView: true,
      userEvent: "input",
    }),
  )
  return true
}

export const markdownFormatKeymap: KeyBinding[] = [
  {
    key: "Mod-b",
    run: (view) => {
      toggleWrap(view, "**", "bold")
      return true
    },
  },
  {
    key: "Mod-i",
    run: (view) => {
      toggleWrap(view, "_", "italic")
      return true
    },
  },
  { key: "Enter", run: continueList },
]

/**
 * Pasting a bare URL over a non-empty selection wraps it as a link instead of
 * replacing the text — mirrors the behaviour the old textarea had. Returns
 * true when handled so CM skips its default paste.
 */
export function pasteLinkHandler(
  event: ClipboardEvent,
  view: EditorView,
): boolean {
  const range = view.state.selection.main
  if (range.empty) return false
  const pasted = event.clipboardData?.getData("text/plain")?.trim() ?? ""
  if (!/^https?:\/\/\S+$/i.test(pasted)) return false
  event.preventDefault()
  const selected = view.state.sliceDoc(range.from, range.to)
  const insert = `[${selected}](${pasted})`
  view.dispatch(
    view.state.update({
      changes: { from: range.from, to: range.to, insert },
      selection: {
        anchor: range.from + 1,
        head: range.from + 1 + selected.length,
      },
      userEvent: "input.paste",
    }),
  )
  return true
}
