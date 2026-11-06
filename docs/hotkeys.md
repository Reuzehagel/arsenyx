# Hotkeys

Single source of truth: [`apps/web/src/lib/hooks/hotkeys.ts`](../apps/web/src/lib/hooks/hotkeys.ts).

`HOTKEYS` is a record of entries (`scope`, display `keys`, `description`, and for window-level shortcuts a `binding`). It drives both the cheat-sheet dialog (opened by `?` or the keyboard button in the header) and the listeners: `useHotkey(HOTKEYS.save, handler)` matches the entry's `binding`, so what the cheat-sheet shows and what fires can't drift. Entries without a `binding` document element-local keys (the mod grid's Tab/Enter, the guide editor's shortcuts).

## Rules

- **Every site-wide hotkey is a `HOTKEYS` entry with a `binding`, registered through `useHotkey(HOTKEYS.<id>, …)`** ([apps/web/src/lib/hooks/hotkeys.ts](../apps/web/src/lib/hooks/hotkeys.ts)). It absorbs the editable-target guard and modifier parsing — don't hand-roll `addEventListener("keydown", …)` blocks. Element-scoped handlers (a textarea's own `onKeyDown`, a result-grid card) stay element-local.
- A search box's `/` uses `useSearchHotkey(HOTKEYS.<id>, inputRef)` (focus + select).
- **If a hotkey affects a specific control, render a `<Kbd>` chip on that control** in addition to the cheat-sheet entry. Examples: the header's search button shows `Ctrl K`; the browse, mod-search, and directory (`/orgs`, `/users`) inputs show `/`.
- **Bare letters are reserved for editor-local handlers** (e.g. the guide-editor textarea uses `Ctrl+B` / `Ctrl+I`). Don't bind bare letters at the window level — they collide with text input and editor surfaces.
- **`?` always opens the cheat-sheet.** Don't bind it elsewhere.

## Conventions

- A key can mean different things in different surfaces (`/` focuses the browse filter on `/browse`, the directory search on `/orgs` and `/users`, and the mod-search input inside the build editor). That's fine — the cheat-sheet groups by scope so users see the right shortcut for their current context.
- Prefer `mod+x` over `ctrl+x` / `meta+x` so the same binding works on macOS (Cmd) and elsewhere (Ctrl).
- For shifted printables (`?`, `+`, `_`), give the entry a function `binding` rather than a string spec — `binding: (e) => e.key === "?"`.

## Discovery surfaces, in order of cost

1. **`<Kbd>` chip on the relevant control** — cheapest, most discoverable. Users learn passively.
2. **Persistent hint strip** in the build editor — always-visible muted footer summarising the editor's keys ([components/build-editor/keyboard-hints.tsx](../apps/web/src/components/build-editor/keyboard-hints.tsx)).
3. **First-time banner** — one-shot, dismissible, `localStorage`-flagged. Welcomes new users to the editor, then disappears.
4. **Cheat-sheet dialog** (`?`) — full reference, always available.

There is no formal onboarding flow by design. Modal walkthroughs are usually skipped; the four surfaces above cover discovery without interrupting work.
