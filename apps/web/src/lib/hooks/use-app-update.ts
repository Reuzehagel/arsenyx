import { useEffect, useRef } from "react"
import { toast } from "sonner"

/**
 * Notifies the user when a newer deploy is available and offers a one-click
 * reload.
 *
 * We have no service worker, so detection piggybacks on `index.html`, which the
 * CDN serves `must-revalidate` (see public/_headers). Vite injects a single
 * content-hashed entry script (`/assets/index-<hash>.js`); any code change ships
 * a new hash, so a fresh `index.html` references a different entry `src` than the
 * one this tab loaded with. Mismatch ⇒ a new version is live.
 *
 * Polls on an interval and whenever the tab becomes visible again (the moment a
 * returning user is most likely to be on a stale bundle). Fires at most once.
 */
const POLL_MS = 5 * 60 * 1000
const TOAST_ID = "app-update"

function entryHref(doc: Document): string | null {
  const el = doc.querySelector<HTMLScriptElement>('script[type="module"][src]')
  return el?.getAttribute("src") ?? null
}

async function fetchDeployedEntry(signal: AbortSignal): Promise<string | null> {
  const res = await fetch(`/index.html?_=${Date.now()}`, {
    cache: "no-store",
    signal,
  })
  if (!res.ok) return null
  const html = await res.text()
  return entryHref(new DOMParser().parseFromString(html, "text/html"))
}

export function useAppUpdate() {
  const loadedEntry = useRef<string | null>(null)
  const notified = useRef(false)

  useEffect(() => {
    // Dev serves an unhashed `/src/main.tsx` entry, so there's nothing to diff.
    if (import.meta.env.DEV) return
    loadedEntry.current = entryHref(document)
    if (!loadedEntry.current) return

    const controller = new AbortController()

    async function check() {
      if (notified.current || document.visibilityState !== "visible") return
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
