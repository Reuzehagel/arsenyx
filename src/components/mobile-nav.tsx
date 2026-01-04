"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserMenu } from "@/components/auth";
import { NAV_ITEMS, SITE_CONFIG } from "@/lib/constants";
import { Separator } from "@/components/ui/separator";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-left">{SITE_CONFIG.name}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 mt-8">
          {/* Navigation Links */}
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2 py-3 text-base font-medium rounded-md hover:bg-accent transition-colors"
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
  );
}
