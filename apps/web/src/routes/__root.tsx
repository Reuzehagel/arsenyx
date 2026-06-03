import type { QueryClient } from "@tanstack/react-query"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"

import { HotkeyCheatSheet } from "@/components/hotkey-cheat-sheet"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAppUpdate } from "@/lib/hooks/use-app-update"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootLayout,
  },
)

function RootLayout() {
  useAppUpdate()
  return (
    <TooltipProvider>
      <Outlet />
      <HotkeyCheatSheet />
      <Toaster />
    </TooltipProvider>
  )
}
