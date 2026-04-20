# Mod card expand via View Transitions API

**Status:** backburnered 2026-04-17. FPS tanked to ~5 when hovering rapidly over a page full of mod cards. Reverted to legacy's keyframe-based scale + opacity crossfade. Revisit once we have a smaller number of cards on screen at a time (e.g. after paginating / virtualizing the compatible-mods gallery) or once browser perf on many concurrent VT names improves.

## The goal

Make the compact → expanded mod card transition feel **choreographed**: frame top, frame bottom, mod art, drain badge, name, and rank dots each slide/scale into their new positions independently, instead of the whole card scaling as one blob. Closest to what in-game Warframe UI does.

## The approach

Use `document.startViewTransition()` — browser-native FLIP between two different DOM subtrees (compact vs expanded). Browser snapshots the old tree, commits the new one, and tweens matching `view-transition-name` layers between their bounding boxes.

### Layer naming

Per-card id: `mcard-${sanitize(mod.uniqueName)}`. Applied as `viewTransitionName` on:

- `{id}-frame-top` on the top frame `<img>`
- `{id}-frame-bottom` on the bottom frame `<img>`
- `{id}-art` on the mod-art wrapper div (compact has `filter: grayscale+brightness`, expanded removes the filter — browser interpolates)
- `{id}-badge` on the DrainBadge wrapper
- `{id}-name` on the mod name `<span>`
- `{id}-dots` on the RankDots wrapper

Unnamed (crossfade via default root group):
- Info panel (stats rows, lower tab, inner background) — only exists in expanded
- RankCompleteLine — presence depends on isMaxRank

### State machine

```tsx
const activeVT = useRef<ViewTransition | null>(null);

function transitionHover(next: boolean) {
  if (next === isHovered) return;
  if (activeVT.current) {
    try { activeVT.current.skipTransition(); } catch {}
    activeVT.current = null;
  }
  if (!("startViewTransition" in document)) {
    setIsHovered(next);
    return;
  }
  const vt = document.startViewTransition(() => {
    flushSync(() => setIsHovered(next));  // commit synchronously
  });
  activeVT.current = vt;
  vt.finished.finally(() => {
    if (activeVT.current === vt) activeVT.current = null;
  });
}
```

`flushSync` from `react-dom` is required — the VT callback must produce the new DOM synchronously before returning.

### CSS

```css
::view-transition-group(*) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

Single rule covers every named group — individual timing per layer isn't required; different start/end bounding boxes give the orchestrated feel on their own.

### Gotchas we hit

- **`startViewTransition` must be invoked as a method.** Destructuring it off `document` throws `"TypeError: 'startViewTransition' called on an object that does not implement interface Document."` — call as `document.startViewTransition(...)` or a local `doc.startViewTransition(...)` where `doc` points at document.
- **Unique names per card instance** — two cards with the same name on the page cause the browser to skip the naming and fall back to root crossfade. Suffix with a sanitized mod id.
- **Rapid hover toggles queue** — `skipTransition()` on the previous VT before starting a new one.
- **Scroll-close** — same `transitionHover(false)` call works because the API handles interruption.
- **Browser support** (Jan 2026): Chrome 111+, Edge 111+, Safari 18+, Firefox 144+. Feature-detect and fall back to instant swap.

### Why it's backburnered

With ~100 compatible mods rendered in the /create search panel, each hover triggers a VT that:
1. Captures the entire document's visual state for pseudo-elements
2. Invalidates compositor layers
3. Runs 280ms of animation

On a page with many named elements, the snapshot + pseudo-tree setup cost is large enough to crater framerate when hover events fire in quick succession (mousing across cards). Chrome Perf profile showed GPU process saturation; not something tuning durations fixes.

### What might make it viable later

1. **Fewer cards on screen** — once we virtualize / paginate the search panel (show ~20 instead of ~100), the per-VT cost should be acceptable.
2. **Lazier naming** — assign `view-transition-name` only to the hovered card's layers, clear names on all others before the VT starts. Trades JS overhead for GPU work.
3. **Transition one card, not whole document** — `View Transitions for single element` proposal (if/when it ships) would scope the snapshot.
4. **Debounce hover** — wait 50-80ms before starting the VT so flicking across cards doesn't fire one per card.

### Commit where it last worked

`df7165d feat(web): morph mod card with View Transitions API` (followed by `0337e74 fix(web): call startViewTransition as document method`). Check out those two commits to resurrect the implementation verbatim.

### Reference

Agent research transcript (web-verified, Jan 2026) at the end of the brainstorming session that produced the feature; see git log for the commit messages above. Key sources the research cited:

- `developer.chrome.com/blog/view-transitions-in-2025`
- `web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available`
- `caniuse.com/view-transitions`
- `developer.chrome.com/blog/view-transitions-misconceptions`
- `developer.mozilla.org/en-US/docs/Web/API/ViewTransition`
