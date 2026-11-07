/**
 * The "where did I come from" hop for build→build navigation.
 *
 * Clicking a related-build chip replaces the whole page, so the build you were
 * reading disappears with no cheap way back (browser Back works, but it isn't
 * visible on the page and it's lost after any further navigation). The chips
 * therefore stamp a summary of the *source* build into the router's history
 * state; the destination reads it back and pins that build to the front of its
 * own related-builds strip.
 *
 * History state (not sessionStorage) on purpose: it's scoped to the exact
 * history entry, so it survives reload and back/forward, and a build opened
 * cold (pasted link, search result, new tab) correctly shows no back link
 * instead of resurrecting an unrelated build from earlier in the session.
 */
export type BuildTrailEntry = {
  slug: string
  name: string
  item: {
    uniqueName: string
    name: string
    imageName: string | null
  }
  /** Variant (`?v=`) that was active on the source build, so going back lands
   *  on the same tab rather than variant 0. Omitted for the default variant. */
  variant?: number
}

declare module "@tanstack/react-router" {
  interface HistoryState {
    buildFrom?: BuildTrailEntry
  }
}

/**
 * Build the entry a chip stamps for the build currently being viewed. Owns the
 * two rules the shape implies: prefer the live catalog item's image over the
 * build's denormalized (and rot-prone) copy, and omit the variant when it's the
 * default — so callers can't re-derive them differently.
 */
export function buildTrailEntry(
  build: {
    slug: string
    name: string
    item: { uniqueName: string; name: string; imageName: string | null }
  },
  catalogImageName: string | null | undefined,
  activeIndex: number,
): BuildTrailEntry {
  return {
    slug: build.slug,
    name: build.name,
    item: {
      uniqueName: build.item.uniqueName,
      name: build.item.name,
      imageName: catalogImageName ?? build.item.imageName ?? null,
    },
    ...(activeIndex > 0 && { variant: activeIndex }),
  }
}

/** Whether a raw `window.history.state` carries a hop — for code that can't
 *  pull in the router (see build-viewer-body.tsx's Suspense fallback). */
export function hasBuildFrom(state: unknown): boolean {
  return Boolean((state as { buildFrom?: unknown } | null)?.buildFrom)
}
