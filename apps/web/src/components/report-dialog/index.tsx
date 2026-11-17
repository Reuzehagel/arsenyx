import { lazy, Suspense, useEffect, useState } from "react"

const ReportDialog = lazy(() =>
  import("./report-dialog").then((m) => ({ default: m.ReportDialog })),
)

const OPEN_EVENT = "arsenyx:open-report-dialog"

/**
 * The "Report an issue" dialog, mounted once at the root so the footer, the
 * command palette or anything else can open it with `openReportDialog()`
 * (same window-event pattern as the hotkey cheat-sheet). The form itself is
 * lazy: it loads on first open, not with every page.
 */
export function ReportDialogHost() {
  // `pageUrl` is captured when the dialog opens, so it names the page the
  // user was on, and a new open starts a fresh form (the key remounts it).
  const [state, setState] = useState<{ open: boolean; pageUrl: string }>({
    open: false,
    pageUrl: "",
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const onOpen = () => {
      setLoaded(true)
      setState({ open: true, pageUrl: currentPageUrl() })
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  if (!loaded) return null
  return (
    <Suspense fallback={null}>
      <ReportDialog
        key={state.pageUrl}
        open={state.open}
        pageUrl={state.pageUrl}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      />
    </Suspense>
  )
}

/** The current page without its `#fragment`, which never names a page here. */
function currentPageUrl(): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

/** Open the report dialog from anywhere, with the current page pre-filled. */
export function openReportDialog() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}
