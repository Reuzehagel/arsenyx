import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import React from "react"
import ReactDOM from "react-dom/client"

import { ThemeProvider } from "@/components/theme-provider"

import { routeTree } from "./routeTree.gen"
import "@/styles/globals.css"

if (import.meta.env.DEV) {
  import("cssstudio").then(({ startStudio }) => startStudio())
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
