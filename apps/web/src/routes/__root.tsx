import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Outlet,
  Link as RouterLink,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router"

import { HotkeyCheatSheet } from "@/components/hotkey-cheat-sheet"
import { RouteNotFound } from "@/components/route-not-found"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAppUpdate } from "@/lib/hooks/use-app-update"
import { seo } from "@/lib/seo"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    // Default head for every route; leaf routes override title/description
    // via their own `head` (deepest match wins in <HeadContent />).
    head: () => seo(),
    component: RootLayout,
    // Fallbacks for routes without their own; without these TanStack renders
    // a bare "Not Found" with no header or way back.
    notFoundComponent: PageNotFound,
    errorComponent: PageError,
  },
)

function RootLayout() {
  useAppUpdate()
  return (
    <TooltipProvider>
      <HeadContent />
      <Outlet />
      <HotkeyCheatSheet />
      <Toaster />
    </TooltipProvider>
  )
}

function PageNotFound() {
  return (
    <RouteNotFound
      title="Page not found"
      message="There's nothing at this address."
      action={
        <Button nativeButton={false} render={<RouterLink to="/builds" />}>
          Browse builds
        </Button>
      }
    />
  )
}

function PageError() {
  // invalidate re-runs loaders and clears the error; bare `reset` would re-render the same failed state.
  const router = useRouter()
  return (
    <RouteNotFound
      title="Something went wrong"
      message="This page failed to load. Try again, or head back to builds."
      action={
        <div className="flex gap-2">
          <Button onClick={() => router.invalidate()}>Try again</Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<RouterLink to="/builds" />}
          >
            Browse builds
          </Button>
        </div>
      }
    />
  )
}
