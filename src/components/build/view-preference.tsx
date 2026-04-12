"use client"

import { LayoutGrid, List } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ViewMode = "grid" | "list"

const STORAGE_KEY = "arsenyx_view_preference"

interface ViewPreferenceContextValue {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const ViewPreferenceContext = createContext<ViewPreferenceContextValue>({
  viewMode: "grid",
  setViewMode: () => {},
})

export function ViewPreferenceProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("grid")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === "grid" || saved === "list") {
        setViewModeState(saved)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // localStorage unavailable
    }
  }, [])

  return (
    <ViewPreferenceContext value={{ viewMode, setViewMode }}>
      {children}
    </ViewPreferenceContext>
  )
}

export function useViewPreference() {
  return useContext(ViewPreferenceContext)
}

export function ViewToggle({ className }: { className?: string }) {
  const { viewMode, setViewMode } = useViewPreference()

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "size-8 p-0",
          viewMode === "grid" && "bg-accent text-accent-foreground",
        )}
        onClick={() => setViewMode("grid")}
        aria-label="Grid view"
      >
        <LayoutGrid className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "size-8 p-0",
          viewMode === "list" && "bg-accent text-accent-foreground",
        )}
        onClick={() => setViewMode("list")}
        aria-label="List view"
      >
        <List className="size-4" />
      </Button>
    </div>
  )
}
