# Verifying build-editor changes in the browser

The editor needs only the web dev server (`preview_start` name `web`, :5173). The API isn't required until you save.

## Open an editor

`/create?category=<category>&item=<slug>`. Example: `/create?category=warframes&item=excalibur`. Categories and slugs come from `apps/web/public/data/items-index.json`.

## Start from a clean slate

Drafts autosave to localStorage and come back on reload. A leftover mod from an earlier run looks just like a bug. Before every scenario, click **Discard draft** in the header (it's only there while a draft exists), or run `localStorage.clear()` and reload.

Drafts live under `arsenyx:editor-draft:<storeKey>`: the build slug for a saved build, `__new_build__:<category>:<slug>` for a new one.

## Read toasts and isolate a regression

- Toasts last about 4s and land up to a second after load. Poll `[data-sonner-toast]` every 100ms from `javascript_tool`; a single check after a `wait` misses them.
- StrictMode-only? Swap `<React.StrictMode>` for `<>` in `src/main.tsx`, reload, retest, restore. Dev runs mount effects twice; production doesn't.
- New in this branch? `git stash push -u`, reload the same tab, retest against the base, `git stash pop`.

## Drive the mod search

- The search box is `[aria-label="Search mods"]`. Focus it with `.focus()` through `javascript_tool`, or click it. The `/` hotkey only works when focus isn't in another input or slot.
- Results are ranked from a `useDeferredValue` copy of the query. The browser tool types instantly, so typing followed by Enter in the same batch is a race stress test. A human-speed check needs a `wait` of about 1s before Enter.
- Placed mods render in the slot grid at the top of the page. Run `window.scrollTo(0, 0)` and take a screenshot to read them.

## Read the stats panel

- At the browser pane's default width the stats sidebar collapses into a "Stats" popover that is hard to drive. Run `resize_window` at 1500×1000 first so it renders inline, and reset it with preset `desktop` when done.
- Read values with `javascript_tool`: `document.body.innerText`, from `Crit Chance` down through the attack-mode rows (`NORMAL ATTACK`, `INCARNON FORM`, …).
- Incarnon weapons: the toggle is the visible `[role="switch"]` labelled Incarnon; tier pickers are buttons `T2`–`T5` (`find("T4")`), and a perk is picked by clicking its name.
