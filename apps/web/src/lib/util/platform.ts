/**
 * True on macOS / iPadOS / iOS. Evaluated once at module load — the web app is
 * a client-only SPA (no SSR), so `navigator` is always present. Drives the
 * platform-correct modifier symbol (⌘ vs Ctrl) in shortcut hints.
 */
export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.userAgent)
