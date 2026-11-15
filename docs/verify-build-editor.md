# Verifying build-editor changes in the browser

The editor needs only the web dev server (`preview_start` name `web`, :5173). The API isn't required until you save.

`preview_start` reads only the main checkout's `.claude/launch.json` (gitignored), so `web` always serves the main checkout's code. To preview a worktree, add an entry there with `--cwd=.claude/worktrees/<name>/apps/web` and a free `--port`.

## Open an editor

`/create?category=<category>&item=<slug>`. Example: `/create?category=warframes&item=excalibur`. Categories and slugs come from `apps/web/public/data/items-index.json`.

## Start from a clean slate

Drafts autosave to localStorage and come back on reload. A leftover mod from an earlier run looks just like a bug. Before every scenario, click **Discard draft** in the header (it's only there while a draft exists), or run `localStorage.clear()` and reload.

Drafts live under `arsenyx:editor-draft:<storeKey>`: the build slug for a saved build, `__new_build__:<category>:<slug>` for a new one. Read one with `JSON.parse(localStorage[key]).payload.buildData`. A draft is written 600 ms after the last edit, or at once when the editor unmounts or the page hides with a write still pending (unless the draft was cleared since: a save or Discard). A draft that appears right after you navigate away is that flush, not a bug. A client-side link unmounts the editor only once the next page has loaded (about a second), so wait ~1.5s before checking the draft after leaving.

## Forma a slot and add Variants

- The first click on a slot selects it; a second click opens its polarity picker: buttons `[aria-label="Apply <polarity> polarity"]` and `Clear polarity`. At the default pane size the picker opens below the fold, so `resize_window` to 1280×1000 first, or click the button through `javascript_tool`. The header's forma count is the quickest readout.
- The Variant bar (tabs, the forma & shards mode toggle) only renders with two or more Variants. Start with **Copy** (the button next to **Variant**).

Opening a `?share=` or `?draft=` (import) link writes it as that item's draft and drops the param from the URL, so a refresh restores it. A draft it replaced is offered back by a "Replaced your unsaved draft" toast (Restore it).

## Judge open/closed state

Run `tabs_context` first. A hidden pane runs the page as a background tab, so a closed Base UI popover or dialog stays in the DOM through its exit animation for seconds. Read its `data-open` / `data-closed` attribute, not whether the element exists. To see what closed it, log `onOpenChange`'s second argument: its `reason` is `escape-key`, `trigger-press`, `outside-press`, and so on.

## Read toasts and isolate a regression

- Toasts last about 4s and land up to a second after load. Poll `[data-sonner-toast]` every 100ms from `javascript_tool`; a single check after a `wait` misses them.
- StrictMode-only? Swap `<React.StrictMode>` for `<>` in `src/main.tsx`, reload, retest, restore. Dev runs mount effects twice; production doesn't.
- New in this branch? `git stash push -u`, reload the same tab, retest against the base, `git stash pop`.

## Drive the mod search

- The search box is `[aria-label="Search mods"]`. Focus it with `.focus()` through `javascript_tool`, or click it. The `/` hotkey only works when focus isn't in another input or slot.
- Results are ranked from a `useDeferredValue` copy of the query. The browser tool types instantly, so typing followed by Enter in the same batch is a race stress test. A human-speed check needs a `wait` of about 1s before Enter.
- Placed mods render in the slot grid at the top of the page. Run `window.scrollTo(0, 0)` and take a screenshot to read them.
- Set a query without typing, then press Enter, from `javascript_tool` (React ignores a plain `.value =`):

  ```js
  const input = document.querySelector('[aria-label="Search mods"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set
  set.call(input, "serration"); input.dispatchEvent(new Event("input", { bubbles: true }))
  await new Promise((r) => setTimeout(r, 500)) // let the deferred ranking catch up
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  ```
- The `computer` tool names the slash key `/`, not `slash`.

## Drive dropdowns, screenshots and Share

- Sidebar dropdowns are Base UI selects. Clicking an option doesn't always register under automation; open the trigger, then press `Down` × n and `Return`.
- Pane screenshots trail the action by about a second. `wait` 1s before a screenshot you'll judge, or confirm state with `find`/`javascript_tool`.
- At an emulated 1500×1000 viewport, screenshots come back scaled to about 800px wide, so zoomed crops are blurry. Read text with `get_page_text`/`javascript_tool`, not from pixels.
- Share copies the link to the clipboard, and `navigator.clipboard.readText` is denied. Wrap `navigator.clipboard.writeText` to stash its argument on `window`, then click Share.

## Save a build

Saving needs the `api` server and a signed-in user. Email+password auth exists only when `NODE_ENV=development` (`apps/api/src/auth.ts`).

1. Check that `DATABASE_URL` in `apps/api/.env` points at `localhost:54320` (this checkout's own local DB; missing `.env` → `just setup`). `*.psdb.cloud` is prod: stop.
2. If another checkout already holds `:8787`, wire a second web/api pair ([Ports taken by another worktree](commands.md#ports-taken-by-another-worktree)) and use its API port below.
3. Sign in: open `/auth/signin` and click **Sign in**. The dev login form is prefilled with the admin `just setup` seeded ([Sign in as the dev admin](commands.md#sign-in-as-the-dev-admin)).
4. Back in the editor the header shows **Save**; pick **Unlisted** in the save dialog so test builds stay out of listings.

## Read the stats panel

- At the browser pane's default width the stats sidebar collapses into a "Stats" popover that is hard to drive. Run `resize_window` at 1500×1000 first so it renders inline, and reset it with preset `desktop` when done.
- Read values with `javascript_tool`: `document.body.innerText`, from `Crit Chance` down through the attack-mode rows (`NORMAL ATTACK`, `INCARNON FORM`, …).
- Incarnon weapons: the toggle is the visible `[role="switch"]` labelled Incarnon; tier pickers are buttons `T2`–`T5` (`find("T4")`), and a perk is picked by clicking its name.
