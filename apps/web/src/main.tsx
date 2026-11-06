import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import React from "react"
import ReactDOM from "react-dom/client"
import { toast } from "sonner"

import { ThemeProvider } from "@/components/theme-provider"
import { apiErrorMessage } from "@/lib/util/api-client"
import { STORAGE_KEYS, storageGet, storageSet } from "@/lib/util/storage"

import { routeTree } from "./routeTree.gen"
import "@/styles/globals.css"

if (import.meta.env.DEV) {
  setupCssStudio()
}

// Cloudflare Web Analytics — cookieless beacon, injected here (not index.html)
// so dev/preview traffic never pollutes the stats and the embed entry
// (embed-main.tsx, iframed by external guide pages) stays untracked.
// The token is public by design: it ships in the page to every visitor.
// Hostname check keeps forks/mirrors that ship this code out of our stats.
if (import.meta.env.PROD && location.hostname === "www.arsenyx.com") {
  const beacon = document.createElement("script")
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js"
  beacon.defer = true
  beacon.dataset.cfBeacon = JSON.stringify({
    token: "cb404e37bc7c4acfb4f8ef9e86b537e4",
  })
  document.head.append(beacon)
}

function setupCssStudio() {
  const params = new URLSearchParams(location.search)
  const param = params.get("cssstudio")
  if (param === "1" || param === "0") {
    storageSet(STORAGE_KEYS.cssStudio, param)
    // Strip the param so the URL doesn't stay sticky as the user navigates.
    params.delete("cssstudio")
    const qs = params.toString()
    history.replaceState(
      null,
      "",
      location.pathname + (qs ? `?${qs}` : "") + location.hash,
    )
  }
  if (storageGet(STORAGE_KEYS.cssStudio) === "1") {
    void import("cssstudio").then(({ startStudio }) => startStudio())
  } else {
    // eslint-disable-next-line no-console
    console.info(
      "cssstudio is OFF. Append ?cssstudio=1 to the URL to enable, ?cssstudio=0 to disable.",
    )
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
  // Opt-in failure toast for mutations with no inline error UI (optimistic
  // toggles roll back silently otherwise). Set `meta: { errorToast }`.
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      const fallback = mutation.meta?.errorToast
      if (fallback) toast.error(apiErrorMessage(err, fallback))
    },
  }),
})

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  // No defaultPreloadStaleTime: per-query staleTime governs preloads (static
  // game-data queries use Infinity; user data uses the QueryClient default).
  context: { queryClient },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { errorToast?: string }
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
