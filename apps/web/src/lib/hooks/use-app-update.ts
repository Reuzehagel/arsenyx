import { useEffect, useRef } from "react"
import { toast } from "sonner"

/**
 * Notifies the user when a newer deploy is available and offers a one-click
 * reload.
 *
 * We have no service worker, so detection polls `/version.json` — a tiny static
 * asset emitted at build time (see the `versionFile()` plugin in vite.config.ts)
 * holding the SPA's content-hashed entry filename. Vite injects a single
 * content-hashed entry script (`/assets/main-<hash>.js`); any code change ships
 * a new hash, so the deployed `version.json` carries a different `entry` than the
 * one this tab loaded with. Mismatch ⇒ a new version is live.
 *
 * `/version.json` is excluded from the edge Worker and served straight from the
 * assets binding (wrangler.toml + public/_headers), so each poll is a cheap CDN
 * 304 with zero Worker invocations — earlier this polled `/index.html`, which
 * ran the Worker and 307-redirected (two billed hits per poll per open tab).
 *
 * Polls on an interval and whenever the tab becomes visible again (the moment a
 * returning user is most likely to be on a stale bundle), throttled so rapid
 * tab focus changes can't fan out a burst of requests. Fires at most once.
 */
const POLL_MS = 5 * 60 * 1000
// Collapse a burst of visibility/interval triggers without throttling the poll
// cadence itself. Kept well under POLL_MS so the periodic tick never races it
// and a user returning a few minutes after load still gets a fresh check.
const MIN_REFETCH_MS = 30 * 1000
const TOAST_ID = "app-update"

function entryHref(doc: Document): string | null {
  const el = doc.querySelector<HTMLScriptElement>('script[type="module"][src]')
  return el?.getAttribute("src") ?? null
}

async function fetchDeployedEntry(signal: AbortSignal): Promise<string | null> {
  // `no-cache` (revalidate every time), not `no-store`: it sends If-None-Match
  // so an unchanged file comes back as a cheap 304, while a new deploy still
  // gets a fresh 200. `no-store` would suppress the conditional request and
  // force a full 200 every poll.
  const res = await fetch("/version.json", { cache: "no-cache", signal })
  if (!res.ok) return null
  const { entry } = (await res.json()) as { entry?: string | null }
  return entry ?? null
}

export function useAppUpdate() {
  const loadedEntry = useRef<string | null>(null)
  const notified = useRef(false)
  const lastCheck = useRef(0)

  useEffect(() => {
    // Dev serves an unhashed `/src/main.tsx` entry, so there's nothing to diff.
    if (import.meta.env.DEV) return
    loadedEntry.current = entryHref(document)
    if (!loadedEntry.current) return

    const controller = new AbortController()

    async function check() {
      if (notified.current || document.visibilityState !== "visible") return
      // Collapse rapid focus flips into one request; the periodic interval is
      // far longer than this window so it always passes.
      if (Date.now() - lastCheck.current < MIN_REFETCH_MS) return
      lastCheck.current = Date.now()
      try {
        const latest = await fetchDeployedEntry(controller.signal)
        if (latest && latest !== loadedEntry.current) {
          notified.current = true
          toast("A new version of Arsenyx is available", {
            id: TOAST_ID,
            description: "Reload to get the latest changes.",
            duration: Infinity,
            action: {
              label: "Reload",
              onClick: () => window.location.reload(),
            },
          })
        }
      } catch {
        // Offline or a transient blip — just try again on the next tick.
      }
    }

    const interval = setInterval(() => void check(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)
    void check()

    return () => {
      controller.abort()
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
}
