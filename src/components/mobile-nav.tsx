"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { UserMenu } from "@/components/auth/user-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { NAV_ITEMS, SITE_CONFIG } from "@/lib/constants"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
          />
        }
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-left">{SITE_CONFIG.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-8 flex flex-col gap-4">
          {/* Navigation Links */}
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-3 text-base font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Separator />

          {/* User Menu Section */}
          <div className="flex items-center gap-2 px-2">
            <UserMenu />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
