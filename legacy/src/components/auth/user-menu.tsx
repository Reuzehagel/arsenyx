"use client"

import Image from "next/image"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useState } from "react"

const SettingsSheet = dynamic(
  () =>
    import("@/components/settings").then((mod) => mod.SettingsSheet),
  { ssr: false },
)
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession, signOut } from "@/lib/auth-client"

export function UserMenu() {
  const { data: session, isPending } = useSession()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (isPending) {
    return <Skeleton className="size-8 rounded-full" />
  }

  if (!session?.user) {
    return (
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/auth/signin" />}
        nativeButton={false}
      >
        Sign In
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="focus-visible:ring-ring flex items-center gap-2 rounded-full outline-none focus-visible:ring-2" />
          }
        >
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User avatar"}
              width={32}
              height={32}
              unoptimized
              className="rounded-full"
            />
          ) : (
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full">
              {session.user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block font-medium">{session.user.name}</span>
              <span className="text-muted-foreground block text-xs font-normal">
                {session.user.email}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {session.user.username && (
              <DropdownMenuItem
                render={<Link href={`/profile/${session.user.username}`} />}
              >
                My Profile
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/builds/mine" />}>
              My Builds
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/favorites" />}>
              Favorites
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = "/"
                    },
                  },
                })
              }
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
