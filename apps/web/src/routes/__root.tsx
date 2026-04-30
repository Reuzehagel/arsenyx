import type { QueryClient } from "@tanstack/react-query"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"

import { HotkeyCheatSheet } from "@/components/hotkey-cheat-sheet"
import { TooltipProvider } from "@/components/ui/tooltip"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootLayout,
  },
)

function RootLayout() {
  return (
    <TooltipProvider>
      <Outlet />
      <HotkeyCheatSheet />
    </TooltipProvider>
  )
}
