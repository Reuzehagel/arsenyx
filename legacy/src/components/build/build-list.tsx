"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { useViewPreference, ViewToggle } from "./view-preference"

interface BuildListProps {
  children: ReactNode
  /** Count label shown next to the toggle, e.g. "5 builds" */
  count?: number
  className?: string
  /** Hide the toolbar row (when the parent provides its own toggle) */
  showToolbar?: boolean
}

export function BuildList({ children, count, className, showToolbar = true }: BuildListProps) {
  const { viewMode } = useViewPreference()

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar && (
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
      )}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
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
