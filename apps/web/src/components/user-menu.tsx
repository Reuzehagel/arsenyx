import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { LogIn } from "lucide-react"

import { Link } from "@/components/link"
import { SettingsDialog } from "@/components/settings-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { ROUTES } from "@/lib/constants"

export function UserMenu() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (isPending) {
    return <div className="bg-muted size-8 animate-pulse rounded-full" />
  }

  if (!session) {
    return (
      <Button
        size="sm"
        variant="ghost"
        render={<Link href={ROUTES.signIn} />}
        nativeButton={false}
      >
        <LogIn className="size-4" />
        Sign in
      </Button>
    )
  }

  const user = session.user
  const name = user.name ?? user.email ?? "Account"
  const initial = name.charAt(0).toUpperCase()
  const isAdmin = (user as { role?: string }).role === "admin"

  async function onSignOut() {
    await authClient.signOut()
    navigate({ to: ROUTES.home })
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open user menu"
            className="relative"
          />
        }
      >
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span className="bg-muted text-foreground flex size-7 items-center justify-center rounded-full text-sm font-medium">
            {initial}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="text-sm font-medium">{name}</span>
          {user.email ? (
            <span className="text-muted-foreground truncate text-xs">
              {user.email}
            </span>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={ROUTES.profile} />}>
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={ROUTES.myBuilds} />}>
          My Builds
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={ROUTES.favorites} />}>
          My Favorites
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
          Settings
        </DropdownMenuItem>
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={ROUTES.admin} />}>
              Admin
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
