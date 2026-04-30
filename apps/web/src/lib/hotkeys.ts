import { useEffect, useRef } from "react"

import { isEditableTarget } from "@/lib/utils"

/**
 * Single source of truth for keyboard shortcuts. Adding an entry to `HOTKEYS`
 * makes it appear in the cheat-sheet dialog automatically.
 *
 * Bare a–z letters are reserved for editor-local handlers (textarea, slot
 * grid) — avoid binding them at the window level so they don't collide with
 * text input. Punctuation (`/`, `?`, `-`, `=`) is fine globally.
 */

export type HotkeyScope =
  | "Global"
  | "Browse"
  | "Build editor"
  | "Mod search"
  | "Guide editor"

export type Hotkey = {
  scope: HotkeyScope
  /** Each entry is one renderable Kbd. Multiple entries = alternatives. */
  keys: readonly string[]
  description: string
}

export const HOTKEYS: readonly Hotkey[] = [
  {
    scope: "Global",
    keys: ["Ctrl K", "⌘ K"],
    description: "Open the command palette",
  },
  {
    scope: "Global",
    keys: ["?"],
    description: "Show this shortcut list",
  },
  {
    scope: "Browse",
    keys: ["/"],
    description: "Focus the search filter",
  },
  {
    scope: "Build editor",
    keys: ["↑", "↓", "←", "→"],
    description: "Move between slots",
  },
  {
    scope: "Build editor",
    keys: ["−", "="],
    description: "Lower or raise the rank of the selected mod / arcane",
  },
  {
    scope: "Build editor",
    keys: ["Esc"],
    description: "Deselect the current slot",
  },
  {
    scope: "Mod search",
    keys: ["/"],
    description: "Focus the mod search input",
  },
  {
    scope: "Mod search",
    keys: ["Tab"],
    description: "Move from the search input into the result grid",
  },
  {
    scope: "Mod search",
    keys: ["Enter"],
    description: "Place the focused mod into the selected slot",
  },
  {
    scope: "Mod search",
    keys: ["Esc"],
    description: "Return focus to the search input",
  },
  {
    scope: "Guide editor",
    keys: ["Ctrl B", "⌘ B"],
    description: "Wrap selection in **bold**",
  },
  {
    scope: "Guide editor",
    keys: ["Ctrl I", "⌘ I"],
    description: "Wrap selection in _italic_",
  },
  {
    scope: "Guide editor",
    keys: ["Tab", "Shift Tab"],
    description: "Indent / dedent the current line",
  },
  {
    scope: "Guide editor",
    keys: ["Enter"],
    description: "Continue list bullets onto the next line",
  },
]

// Insertion order from `HOTKEYS` — render the cheat-sheet sections in the
// same order they're declared.
export const HOTKEY_SCOPES: readonly HotkeyScope[] = [
  ...new Set(HOTKEYS.map((h) => h.scope)),
]

// ---------------------------------------------------------------------------
// useHotkey
// ---------------------------------------------------------------------------

type Matcher = string | readonly string[] | ((e: KeyboardEvent) => boolean)

type Options = {
  /** When false, the listener is not attached. */
  enabled?: boolean
  /** When true, fire even if focus is in an INPUT / TEXTAREA / contentEditable. */
  allowInEditable?: boolean
  /** When true (default), preventDefault on a match. */
  preventDefault?: boolean
}

/**
 * Window-scoped keyboard shortcut. Use for site-wide hotkeys; for shortcuts
 * that only apply while a specific element is focused, attach `onKeyDown`
 * directly to that element instead.
 *
 * The `matcher` accepts:
 *   - `"k"`              — bare key, requires no modifiers and no shift
 *   - `"mod+k"`          — `mod` matches Cmd on mac, Ctrl elsewhere
 *   - `"shift+/"`, `"ctrl+shift+p"`, `"alt+enter"` — explicit modifiers
 *   - `["ArrowUp", "ArrowDown", ...]` — any-of, shorthand for multiple specs
 *   - `(e) => boolean`   — fully custom (use for shifted printables like `?`)
 */
export function useHotkey(
  matcher: Matcher,
  handler: (e: KeyboardEvent) => void,
  opts: Options = {},
) {
  const {
    enabled = true,
    allowInEditable = false,
    preventDefault = true,
  } = opts

  // Refs let everything that can change between renders — handler, matcher,
  // and the option flags — flow into the listener without re-binding it.
  // Without this, callers like `useRankHotkey` (whose `enabled` flips on
  // hover) would attach/detach window listeners on every mouse-enter/leave.
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const matcherRef = useRef(matcher)
  matcherRef.current = matcher
  const optsRef = useRef({ enabled, allowInEditable, preventDefault })
  optsRef.current = { enabled, allowInEditable, preventDefault }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = optsRef.current
      if (!o.enabled) return
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
