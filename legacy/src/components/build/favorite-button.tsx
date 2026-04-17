"use client"

import { Heart } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { toggleFavoriteAction } from "@/app/actions/social"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  buildId: string
  initialFavoriteCount: number
  initialHasFavorited: boolean
  /** Whether to show the count (default: true) */
  showCount?: boolean
}

export function FavoriteButton({
  buildId,
  initialFavoriteCount,
  initialHasFavorited,
  showCount = true,
}: FavoriteButtonProps) {
  const { data: session, isPending: isSessionLoading } = useSession()
  const [isPending, startTransition] = useTransition()
  const [hasFavorited, setHasFavorited] = useState(initialHasFavorited)
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount)

  const handleFavorite = () => {
    if (isSessionLoading) return

    if (!session?.user) {
      toast.error("Sign in to save favorites")
      return
    }

    // Optimistic update
    setHasFavorited((prev) => !prev)
    setFavoriteCount((prev) => (hasFavorited ? prev - 1 : prev + 1))

    startTransition(async () => {
      const result = await toggleFavoriteAction(buildId)

      if (!result.success) {
        // Revert on error
        setHasFavorited((prev) => !prev)
        setFavoriteCount((prev) => (hasFavorited ? prev + 1 : prev - 1))
        toast.error(result.error ?? "Failed to update favorite")
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-8 gap-1.5", hasFavorited && "text-destructive")}
      onClick={handleFavorite}
      disabled={isPending}
    >
      <Heart
        data-icon="inline-start"
        className={cn(hasFavorited && "fill-current")}
      />
      {showCount && <span className="tabular-nums">{favoriteCount}</span>}
    </Button>
  )
}
