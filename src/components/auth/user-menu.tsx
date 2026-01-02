"use client";

import { useSession, signOut } from "@/lib/auth-client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export function UserMenu() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="size-8 animate-pulse rounded-full bg-muted" />
    );
  }

  if (!session?.user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/auth/signin">Sign In</Link>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User avatar"}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {session.user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="px-2 py-1.5">
          <p className="font-medium">{session.user.name}</p>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
        </div>
        <Separator className="my-2" />
        <div className="space-y-1">
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
          onClick={() => signOut({ fetchOptions: { onSuccess: () => window.location.href = "/" } })}
          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
        >
          Sign Out
        </button>
      </PopoverContent>
    </Popover>
  );
}

function MenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent"
    >
      {children}
    </Link>
  );
}
