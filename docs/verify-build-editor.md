# Verifying build-editor changes in the browser

The editor needs only the web dev server (`preview_start` name `web`, :5173). The API isn't required until you save.

## Open an editor

`/create?category=<category>&item=<slug>`. Example: `/create?category=warframes&item=excalibur`. Categories and slugs come from `apps/web/public/data/items-index.json`.

## Start from a clean slate

Drafts autosave to localStorage and come back on reload. A leftover mod from an earlier run looks just like a bug. Before every scenario, click **Discard draft** in the header (it's only there while a draft exists).

## Drive the mod search

- The search box is `[aria-label="Search mods"]`. Focus it with `.focus()` through `javascript_tool`, or click it. The `/` hotkey only works when focus isn't in another input or slot.
- Results are ranked from a `useDeferredValue` copy of the query. The browser tool types instantly, so typing followed by Enter in the same batch is a race stress test. A human-speed check needs a `wait` of about 1s before Enter.
- Placed mods render in the slot grid at the top of the page. Run `window.scrollTo(0, 0)` and take a screenshot to read them.
