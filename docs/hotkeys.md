# Hotkeys

Single source of truth: [`apps/web/src/lib/hotkeys.ts`](../apps/web/src/lib/hotkeys.ts).

The `HOTKEYS` array drives the cheat-sheet dialog (opened by `?` or the keyboard button in the header). Adding an entry there is the only step needed to make a shortcut discoverable site-wide.

## Rules

- **Every site-wide hotkey is registered through `useHotkey`** ([apps/web/src/lib/hotkeys.ts](../apps/web/src/lib/hotkeys.ts)). It absorbs the editable-target guard and modifier parsing — don't hand-roll `addEventListener("keydown", …)` blocks. Element-scoped handlers (a textarea's own `onKeyDown`, a result-grid card) stay element-local.
- **Every site-wide hotkey appears in `HOTKEYS`.** If the cheat-sheet doesn't list it, users can't discover it.
- **If a hotkey affects a specific control, render a `<Kbd>` chip on that control** in addition to the cheat-sheet entry. Examples: the header's search button shows `Ctrl K`; the browse and mod-search inputs show `/`.
- **Bare letters are reserved for editor-local handlers** (e.g. the guide-editor textarea uses `Ctrl+B` / `Ctrl+I`). Don't bind bare letters at the window level — they collide with text input and editor surfaces.
- **`?` always opens the cheat-sheet.** Don't bind it elsewhere.

## Conventions

- A key can mean different things in different surfaces (`/` focuses the browse filter on `/browse`, focuses the mod-search input inside the build editor). That's fine — the cheat-sheet groups by scope so users see the right shortcut for their current context.
- Prefer `mod+x` over `ctrl+x` / `meta+x` so the same binding works on macOS (Cmd) and elsewhere (Ctrl).
- For shifted printables (`?`, `+`, `_`), pass a function matcher to `useHotkey` rather than a string spec — `useHotkey((e) => e.key === "?", …)`.

## Discovery surfaces, in order of cost

1. **`<Kbd>` chip on the relevant control** — cheapest, most discoverable. Users learn passively.
2. **Persistent hint strip** in the build editor — always-visible muted footer summarising the editor's keys ([components/build-editor/keyboard-hints.tsx](../apps/web/src/components/build-editor/keyboard-hints.tsx)).
3. **First-time banner** — one-shot, dismissible, `localStorage`-flagged. Welcomes new users to the editor, then disappears.
4. **Cheat-sheet dialog** (`?`) — full reference, always available.

There is no formal onboarding flow by design. Modal walkthroughs are usually skipped; the four surfaces above cover discovery without interrupting work.
