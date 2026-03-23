"use client"

import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useSession, signOut } from "@/lib/auth-client"

export function UserMenu() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <div className="bg-muted size-8 animate-pulse rounded-full" />
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
    <Popover>
      <PopoverTrigger
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="px-2 py-1.5">
          <p className="font-medium">{session.user.name}</p>
          <p className="text-muted-foreground text-xs">{session.user.email}</p>
        </div>
        <Separator className="my-2" />
        <div className="flex flex-col gap-1">
          {session.user.username && (
            <MenuLink href={`/profile/${session.user.username}`}>
              My Profile
            </MenuLink>
          )}
          <MenuLink href="/builds/mine">My Builds</MenuLink>
          <MenuLink href="/favorites">Favorites</MenuLink>
        </div>
        <Separator className="my-2" />
        <button
          onClick={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/"
                },
              },
            })
          }
          className="text-destructive hover:bg-destructive/10 w-full rounded-md px-2 py-1.5 text-left text-sm"
        >
          Sign Out
        </button>
      </PopoverContent>
    </Popover>
  )
}

function MenuLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="hover:bg-accent block rounded-md px-2 py-1.5 text-sm"
    >
      {children}
    </Link>
  )
}
