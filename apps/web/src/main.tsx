import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import React from "react"
import ReactDOM from "react-dom/client"

import { ThemeProvider } from "@/components/theme-provider"

import { routeTree } from "./routeTree.gen"
import "@/styles/globals.css"

if (import.meta.env.DEV) {
  setupCssStudio()
}

function setupCssStudio() {
  const KEY = "arsenyx.cssstudio"
  const params = new URLSearchParams(location.search)
  const param = params.get("cssstudio")
  if (param === "1" || param === "0") {
    try {
      localStorage.setItem(KEY, param)
    } catch {
      /* private mode — fine, just won't persist */
    }
    // Strip the param so the URL doesn't stay sticky as the user navigates.
    params.delete("cssstudio")
    const qs = params.toString()
    history.replaceState(
      null,
      "",
      location.pathname + (qs ? `?${qs}` : "") + location.hash,
    )
  }
  let on = false
  try {
    on = localStorage.getItem(KEY) === "1"
  } catch {
    /* fine */
  }
  if (on) {
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
})

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  context: { queryClient },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
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
