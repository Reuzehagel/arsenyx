import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import {
  EditorSelection,
  EditorState,
  type Transaction,
} from "@codemirror/state"
import { type EditorView } from "@codemirror/view"
import { describe, expect, test } from "vitest"

import { computeActiveFormats, type ActiveFormat } from "./markdown-active"
import {
  insertCodeBlock,
  insertLink,
  insertTemplate,
  insertVideo,
  markdownFormatKeymap,
  pasteLinkHandler,
  setHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleQuote,
  toggleWrap,
} from "./markdown-commands"

// The commands only touch EditorState (DOM-free), so a minimal fake view —
// state + dispatch + focus — exercises them in the node test env with no jsdom.
// Every command dispatches a Transaction produced by `state.update`, which
// carries the resulting `.state`.
function makeView(doc: string, anchor = doc.length, head = anchor) {
  let state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdown({ base: markdownLanguage })],
  })
  const view = {
    get state() {
      return state
    },
    dispatch(tr: Transaction) {
      state = tr.state
    },
    focus() {},
  }
  return view as unknown as EditorView
}

const sel = (view: EditorView): [number, number] => [
  view.state.selection.main.from,
  view.state.selection.main.to,
]

const runEnter = (view: EditorView): boolean => {
  const enter = markdownFormatKeymap.find((b) => b.key === "Enter")
  return enter?.run?.(view) ?? false
}

describe("toggleWrap", () => {
  test("wraps a selection and leaves it selected", () => {
    const view = makeView("hello world", 0, 5)
    toggleWrap(view, "**", "bold")
    expect(view.state.doc.toString()).toBe("**hello** world")
    expect(sel(view)).toEqual([2, 7])
  })

  test("toggles off when the markers flank the selection", () => {
    const view = makeView("**hello** world", 2, 7)
    toggleWrap(view, "**", "bold")
    expect(view.state.doc.toString()).toBe("hello world")
  })

  test("toggles off when the selection includes the markers", () => {
    const view = makeView("**hello** world", 0, 9)
    toggleWrap(view, "**", "bold")
    expect(view.state.doc.toString()).toBe("hello world")
  })

  test("inserts a placeholder on an empty selection", () => {
    const view = makeView("", 0)
    toggleWrap(view, "**", "bold")
    expect(view.state.doc.toString()).toBe("**bold**")
    expect(sel(view)).toEqual([2, 6])
  })
})

describe("setHeading", () => {
  test("adds, toggles off at the same level, and switches level", () => {
    const view = makeView("Title", 0)
    setHeading(view, 2)
    expect(view.state.doc.toString()).toBe("## Title")
    setHeading(view, 2)
    expect(view.state.doc.toString()).toBe("Title")
    setHeading(view, 2)
    setHeading(view, 3)
    expect(view.state.doc.toString()).toBe("### Title")
  })

  test("replaces a conflicting list marker", () => {
    const view = makeView("- item", 0)
    setHeading(view, 2)
    expect(view.state.doc.toString()).toBe("## - item")
  })
})

describe("list and quote toggles", () => {
  test("bullet list adds and removes", () => {
    const view = makeView("a\nb", 0, 3) // both lines
    toggleBulletList(view)
    expect(view.state.doc.toString()).toBe("- a\n- b")
    toggleBulletList(view)
    expect(view.state.doc.toString()).toBe("a\nb")
  })

  test("ordered list numbers sequentially", () => {
    const view = makeView("a\nb\nc", 0, 5)
    toggleOrderedList(view)
    expect(view.state.doc.toString()).toBe("1. a\n2. b\n3. c")
  })

  test("toggling bullet → ordered strips the bullet first", () => {
    const view = makeView("- a", 0)
    toggleOrderedList(view)
    expect(view.state.doc.toString()).toBe("1. a")
  })

  test("quote adds and removes", () => {
    const view = makeView("a", 0)
    toggleQuote(view)
    expect(view.state.doc.toString()).toBe("> a")
    toggleQuote(view)
    expect(view.state.doc.toString()).toBe("a")
  })
})

describe("inserts", () => {
  test("link wraps the selection and selects the url", () => {
    const view = makeView("click", 0, 5)
    insertLink(view)
    expect(view.state.doc.toString()).toBe("[click](url)")
    expect(view.state.sliceDoc(...sel(view))).toBe("url")
  })

  test("code block fences the selection", () => {
    const view = makeView("x", 0, 1)
    insertCodeBlock(view)
    expect(view.state.doc.toString()).toBe("```\nx\n```")
  })

  test("video drops a placeholder url on its own line", () => {
    const view = makeView("intro", 5)
    insertVideo(view)
    expect(view.state.doc.toString()).toBe(
      "intro\n\nhttps://youtu.be/VIDEO_ID\n",
    )
  })

  test("template replaces an empty doc but inserts on its own line otherwise", () => {
    const empty = makeView("", 0)
    insertTemplate(empty, "## Heading")
    expect(empty.state.doc.toString()).toBe("## Heading")

    const nonEmpty = makeView("text", 4)
    insertTemplate(nonEmpty, "## Heading")
    expect(nonEmpty.state.doc.toString()).toBe("text\n\n## Heading")
  })
})

describe("list auto-continue (Enter)", () => {
  test("continues a bullet item", () => {
    const view = makeView("- hello", 7)
    expect(runEnter(view)).toBe(true)
    expect(view.state.doc.toString()).toBe("- hello\n- ")
  })

  test("increments a numbered item", () => {
    const view = makeView("1. first", 8)
    runEnter(view)
    expect(view.state.doc.toString()).toBe("1. first\n2. ")
  })

  test("exits the list on an empty item", () => {
    const view = makeView("- ", 2)
    runEnter(view)
    expect(view.state.doc.toString()).toBe("")
  })

  test("splits (not strips) when Enter is pressed right after the marker", () => {
    // Regression: deciding empty-vs-continue from text-before-caret used to
    // mis-read this as an empty item and delete the bullet.
    const view = makeView("- hello", 2)
    runEnter(view)
    expect(view.state.doc.toString()).toBe("- \n- hello")
  })

  test("returns false outside a list", () => {
    const view = makeView("plain text", 10)
    expect(runEnter(view)).toBe(false)
  })
})

describe("pasteLinkHandler", () => {
  const fakePaste = (text: string) =>
    ({
      clipboardData: { getData: () => text },
      preventDefault() {},
    }) as unknown as ClipboardEvent

  test("wraps a selection with a pasted url", () => {
    const view = makeView("text", 0, 4)
    expect(pasteLinkHandler(fakePaste("https://x.com"), view)).toBe(true)
    expect(view.state.doc.toString()).toBe("[text](https://x.com)")
  })

  test("ignores non-urls", () => {
    const view = makeView("text", 0, 4)
    expect(pasteLinkHandler(fakePaste("not a url"), view)).toBe(false)
  })

  test("ignores an empty selection", () => {
    const view = makeView("text", 2)
    expect(pasteLinkHandler(fakePaste("https://x.com"), view)).toBe(false)
  })
})

describe("computeActiveFormats", () => {
  const formatsAt = (doc: string, pos: number): ActiveFormat[] =>
    [...computeActiveFormats(makeView(doc, pos).state)].sort()

  test("detects inline emphasis", () => {
    expect(formatsAt("**bold**", 3)).toContain("bold")
    expect(formatsAt("_italic_", 3)).toContain("italic")
    expect(formatsAt("`code`", 3)).toContain("code")
  })

  test("detects headings by level", () => {
    expect(formatsAt("# H1", 3)).toContain("h1")
    expect(formatsAt("## H2", 4)).toContain("h2")
    expect(formatsAt("### H3", 5)).toContain("h3")
  })

  test("detects lists and quotes", () => {
    expect(formatsAt("- item", 3)).toContain("ul")
    expect(formatsAt("1. item", 4)).toContain("ol")
    expect(formatsAt("> quote", 3)).toContain("quote")
  })

  test("plain text has no active formats", () => {
    expect(formatsAt("just text", 4)).toEqual([])
  })
})
