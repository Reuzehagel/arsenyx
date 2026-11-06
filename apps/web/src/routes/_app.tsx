import { createFileRoute, Outlet } from "@tanstack/react-router"

import { AppChrome } from "@/components/app-chrome"

// Pathless layout: every page route lives under routes/_app/ and shares this
// chrome, so the header isn't remounted on each navigation.
export const Route = createFileRoute("/_app")({
  component: () => (
    <AppChrome>
      <Outlet />
    </AppChrome>
  ),
})
