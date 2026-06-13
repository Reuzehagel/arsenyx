import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router"

import { HotkeyCheatSheet } from "@/components/hotkey-cheat-sheet"
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
