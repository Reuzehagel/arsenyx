import { syntaxTree } from "@codemirror/language"
import { type EditorState } from "@codemirror/state"

/** Format keys the toolbar can light up when the cursor sits inside them. */
export type ActiveFormat =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "codeblock"
  | "link"
  | "quote"
  | "ul"
  | "ol"
  | "h1"
  | "h2"
  | "h3"

// Lezer markdown node names → our toolbar keys.
const NODE_FORMAT: Record<string, ActiveFormat> = {
  StrongEmphasis: "bold",
  Emphasis: "italic",
  Strikethrough: "strike",
  InlineCode: "code",
  FencedCode: "codeblock",
  CodeBlock: "codeblock",
  Link: "link",
  Blockquote: "quote",
  ATXHeading1: "h1",
  SetextHeading1: "h1",
  ATXHeading2: "h2",
  SetextHeading2: "h2",
  ATXHeading3: "h3",
}

/**
 * Walks the syntax tree from the caret up to the root, collecting the markdown
 * constructs it's nested inside. Cheap enough to run on every selection change.
 */
export function computeActiveFormats(state: EditorState): Set<ActiveFormat> {
  const active = new Set<ActiveFormat>()
  const pos = state.selection.main.head
  let node: ReturnType<typeof syntaxTree>["topNode"] | null = syntaxTree(
    state,
  ).resolveInner(pos, -1)
  while (node) {
    const fmt = NODE_FORMAT[node.name]
    if (fmt) active.add(fmt)
    if (node.name === "ListItem") {
      const parent = node.parent
      if (parent?.name === "BulletList") active.add("ul")
      else if (parent?.name === "OrderedList") active.add("ol")
    }
    node = node.parent
  }
  return active
}

/** Stable equality so the toolbar only re-renders when the set really changes. */
export function sameFormats(
  a: Set<ActiveFormat>,
  b: Set<ActiveFormat>,
): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
