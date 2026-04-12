"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { useViewPreference, ViewToggle } from "./view-preference"

interface BuildListProps {
  children: ReactNode
  /** Count label shown next to the toggle, e.g. "5 builds" */
  count?: number
  className?: string
}

export function BuildList({ children, count, className }: BuildListProps) {
  const { viewMode } = useViewPreference()

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        {count !== undefined ? (
          <p className="text-muted-foreground text-sm">
            {count} {count === 1 ? "build" : "builds"}
          </p>
        ) : (
          <div />
        )}
        <ViewToggle />
      </div>
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            : "flex flex-col gap-2.5"
        }
      >
        {children}
      </div>
    </div>
  )
}

export function useBuildLayout() {
  return useViewPreference().viewMode
}
