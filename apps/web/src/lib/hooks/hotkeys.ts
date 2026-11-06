import { useEffect, useRef, type RefObject } from "react"

/**
 * Single source of truth for keyboard shortcuts: each `HOTKEYS` entry is both
 * the cheat-sheet row and, when it has a `binding`, what `useHotkey` listens
 * for. Entries without one document element-local keys (a textarea's or the
 * mod grid's own onKeyDown).
 *
 * Bare a–z letters are reserved for editor-local handlers (textarea, slot
 * grid) — avoid binding them at the window level so they don't collide with
 * text input. Punctuation (`/`, `?`, `-`, `=`) is fine globally.
 */

type HotkeyScope =
  | "Global"
  | "Browse"
  | "Directories"
  | "Build lists"
  | "Build editor"
  | "Mod search"
  | "Guide editor"

type Matcher = string | readonly string[] | ((e: KeyboardEvent) => boolean)

type Hotkey = {
  scope: HotkeyScope
  /**
   * Each entry is one renderable Kbd; multiple entries = alternatives. The
   * `mod` and `shift` tokens render the platform-correct symbol (⌘/⇧ on Apple,
   * Ctrl/Shift elsewhere) — see KbdKey — so a chord needs only one entry.
   */
  keys: readonly string[]
  description: string
  /** What the window listener matches (see `useHotkey`). */
  binding?: Matcher
}

type BoundHotkey = Hotkey & { binding: Matcher }

// `+` only arrives with shift held, and the string-spec parser enforces shift
// state strictly, so the rank keys use a function. Ctrl/Cmd/Alt must be absent
// or they'd swallow the browser's zoom shortcuts.
const RANK_KEYS = new Set(["-", "_", "=", "+"])

export const HOTKEYS = {
  palette: {
    scope: "Global",
    keys: ["mod K"],
    description: "Open the command palette",
    binding: "mod+k",
  },
  cheatSheet: {
    scope: "Global",
    keys: ["?"],
    description: "Show this shortcut list",
    // A shifted printable: match the produced character, whatever the layout.
    binding: (e) => e.key === "?",
  },
  browseSearch: {
    scope: "Browse",
    keys: ["/"],
    description: "Focus the search filter",
    binding: "/",
  },
  directorySearch: {
    scope: "Directories",
    keys: ["/"],
    description: "Focus the organization / profile search",
    binding: "/",
  },
  buildListSearch: {
    scope: "Build lists",
    keys: ["/"],
    description: "Focus the build search input",
    binding: "/",
  },
  save: {
    scope: "Build editor",
    keys: ["mod S"],
    description: "Save the build",
    binding: "mod+s",
  },
  undo: {
    scope: "Build editor",
    keys: ["mod Z"],
    description: "Undo the last change",
    binding: "mod+z",
  },
  redo: {
    scope: "Build editor",
    keys: ["mod shift Z", "mod Y"],
    description: "Redo",
    binding: ["mod+shift+z", "mod+y"],
  },
  firstEmptySlot: {
    scope: "Build editor",
    keys: ["`"],
    description: "Select the first empty slot",
    binding: "`",
  },
  moveSlot: {
    scope: "Build editor",
    keys: ["↑", "↓", "←", "→"],
    description: "Move between slots",
    binding: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
  },
  rank: {
    scope: "Build editor",
    keys: ["−", "+"],
    description: "Lower or raise the rank of the selected mod / arcane",
    binding: (e) =>
      !e.ctrlKey && !e.metaKey && !e.altKey && RANK_KEYS.has(e.key),
  },
  deselect: {
    scope: "Build editor",
    keys: ["Esc"],
    description: "Deselect the current slot",
    binding: "Escape",
  },
  modSearch: {
    scope: "Mod search",
    keys: ["/"],
    description: "Focus the mod search input",
    binding: "/",
  },
  modSearchIntoGrid: {
    scope: "Mod search",
    keys: ["Tab"],
    description: "Move from the search input into the result grid",
  },
  modSearchPlace: {
    scope: "Mod search",
    keys: ["Enter"],
    description: "Place the focused mod into the selected slot",
  },
  modSearchBack: {
    scope: "Mod search",
    keys: ["Esc"],
    description: "Return focus to the search input",
  },
  guideBold: {
    scope: "Guide editor",
    keys: ["mod B"],
    description: "Wrap selection in **bold**",
  },
  guideItalic: {
    scope: "Guide editor",
    keys: ["mod I"],
    description: "Wrap selection in _italic_",
  },
  guideIndent: {
    scope: "Guide editor",
    keys: ["Tab", "shift Tab"],
    description: "Indent / dedent the current line",
  },
  guideListContinue: {
    scope: "Guide editor",
    keys: ["Enter"],
    description: "Continue list bullets onto the next line",
  },
} as const satisfies Record<string, Hotkey>

/** Cheat-sheet rows, in declaration order. */
export const HOTKEY_LIST: readonly Hotkey[] = Object.values(HOTKEYS)

// Insertion order from `HOTKEYS` — render the cheat-sheet sections in the
// same order they're declared.
export const HOTKEY_SCOPES: readonly HotkeyScope[] = [
  ...new Set(HOTKEY_LIST.map((h) => h.scope)),
]

// ---------------------------------------------------------------------------
// useHotkey
// ---------------------------------------------------------------------------

type Options = {
  /** When true, fire even if focus is in an INPUT / TEXTAREA / contentEditable. */
  allowInEditable?: boolean
  /** When true (default), preventDefault on a match. */
  preventDefault?: boolean
}

/** `/` focuses and selects a search input. */
export function useSearchHotkey(
  hotkey: BoundHotkey,
  ref: RefObject<HTMLInputElement | null>,
) {
  useHotkey(hotkey, () => {
    ref.current?.focus()
    ref.current?.select()
  })
}

/**
 * Window-scoped keyboard shortcut for a `HOTKEYS` entry. Use for site-wide
 * hotkeys; for shortcuts that only apply while a specific element is focused,
 * attach `onKeyDown` directly to that element instead.
 *
 * A `binding` is one of:
 *   - `"k"`              — bare key, requires no modifiers and no shift
 *   - `"mod+k"`          — `mod` matches Cmd on mac, Ctrl elsewhere
 *   - `"shift+/"`, `"ctrl+shift+p"`, `"alt+enter"` — explicit modifiers
 *   - `["ArrowUp", "ArrowDown", ...]` — any-of, shorthand for multiple specs
 *   - `(e) => boolean`   — fully custom (use for shifted printables like `?`)
 */
export function useHotkey(
  hotkey: BoundHotkey,
  handler: (e: KeyboardEvent) => void,
  opts: Options = {},
) {
  const matcher = hotkey.binding
  const { allowInEditable = false, preventDefault = true } = opts

  // Refs let everything that can change between renders — handler, matcher,
  // and the option flags — flow into the listener without re-binding it.
  // Without this, a caller whose handler or options change every render
  // would attach/detach its window listener on every render.
  const handlerRef = useRef(handler)
  const matcherRef = useRef(matcher)
  const optsRef = useRef({ allowInEditable, preventDefault })
  // React 19 forbids ref writes during render; the listener below only reads
  // these refs inside event callbacks, which always fire after this commit.
  useEffect(() => {
    handlerRef.current = handler
    matcherRef.current = matcher
    optsRef.current = { allowInEditable, preventDefault }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = optsRef.current
      if (!o.allowInEditable && isEditableTarget(e.target)) return
      if (!matches(matcherRef.current, e)) return
      if (o.preventDefault) e.preventDefault()
      handlerRef.current(e)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}

function matches(matcher: Matcher, e: KeyboardEvent): boolean {
  if (typeof matcher === "function") return matcher(e)
  const list = typeof matcher === "string" ? [matcher] : matcher
  return list.some((spec) => matchSpec(spec, e))
}

function matchSpec(spec: string, e: KeyboardEvent): boolean {
  const parts = spec
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean)
  const key = parts.pop()
  if (!key) return false
  const mods = new Set(parts)
  const wantShift = mods.has("shift")
  const wantAlt = mods.has("alt")
  const wantMod = mods.has("mod")
  const wantCtrl = mods.has("ctrl")
  const wantMeta = mods.has("meta") || mods.has("cmd")

  if (wantShift !== e.shiftKey) return false
  if (wantAlt !== e.altKey) return false
  if (wantMod) {
    if (!(e.metaKey || e.ctrlKey)) return false
  } else {
    if (wantCtrl !== e.ctrlKey) return false
    if (wantMeta !== e.metaKey) return false
  }
  return e.key.toLowerCase() === key
}

/**
 * True when a keydown target is an editable field — global hotkeys should
 * defer so typing isn't hijacked.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable
  )
}
