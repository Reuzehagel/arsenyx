"use client";

import { useState, useTransition } from "react";
import { useSession } from "@/lib/auth-client";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "@/app/actions/social";
import { toast } from "sonner";

interface FavoriteButtonProps {
  buildId: string;
  initialFavoriteCount: number;
  initialHasFavorited: boolean;
  /** Whether to show the count (default: true) */
  showCount?: boolean;
}

export function FavoriteButton({
  buildId,
  initialFavoriteCount,
  initialHasFavorited,
  showCount = true,
}: FavoriteButtonProps) {
  const { data: session, isPending: isSessionLoading } = useSession();
  const [isPending, startTransition] = useTransition();
  const [hasFavorited, setHasFavorited] = useState(initialHasFavorited);
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount);

  const handleFavorite = () => {
    if (isSessionLoading) return;

    if (!session?.user) {
      toast.error("Sign in to save favorites");
      return;
    }

    // Optimistic update
    const newFavorited = !hasFavorited;
    const newCount = newFavorited ? favoriteCount + 1 : favoriteCount - 1;
    setHasFavorited(newFavorited);
    setFavoriteCount(newCount);

    startTransition(async () => {
      const result = await toggleFavoriteAction(buildId);

      if (!result.success) {
        // Revert on error
        setHasFavorited(hasFavorited);
        setFavoriteCount(favoriteCount);
        toast.error(result.error ?? "Failed to update favorite");
      }
    });
  };

  const isDisabled = isPending || isSessionLoading;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 h-8", hasFavorited && "text-red-500")}
      onClick={handleFavorite}
      disabled={isDisabled}
    >
      <Heart className={cn("h-4 w-4", hasFavorited && "fill-current")} />
      {showCount && <span className="tabular-nums">{favoriteCount}</span>}
    </Button>
  );
}
