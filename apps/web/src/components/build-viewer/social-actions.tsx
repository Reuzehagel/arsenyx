import type { BuildDetailResponse } from "@arsenyx/shared/api/build-dto"
import { useNavigate } from "@tanstack/react-router"
import { Bookmark, Heart, ThumbsDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useSetLike, useToggleBookmark } from "@/lib/queries/build-query"
import { cn } from "@/lib/util/utils"

/**
 * Like / dislike / bookmark buttons. All require auth (redirects to
 * /auth/signin for anonymous users); owners can't like or dislike their own
 * build.
 */
export function SocialActions({ build }: { build: BuildDetailResponse }) {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const like = useSetLike(build.slug)
  const bookmark = useToggleBookmark(build.slug)
  const isOwner = build.isOwner

  // Clicks during an in-flight request are dropped rather than the button
  // being `disabled`: the optimistic update already shows the new state, and
  // disabling made every press flash to half opacity. One request at a time
  // still keeps a slow response from overwriting a newer optimistic state.
  const requireAuthThen = (busy: boolean, run: () => void) => () => {
    if (busy) return
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    run()
  }

  const onLike = requireAuthThen(like.isPending, () =>
    like.mutate(build.viewerHasLiked ? 0 : 1),
  )
  const onDislike = requireAuthThen(like.isPending, () =>
    like.mutate(build.viewerHasDisliked ? 0 : -1),
  )
  const onBookmark = requireAuthThen(bookmark.isPending, () =>
    bookmark.mutate(!build.viewerHasBookmarked),
  )

  // Owners get aria-disabled (not `disabled`) so the hover title explaining
  // why still shows: disabled buttons get no pointer events here.
  const ownerLocked = isOwner && "cursor-not-allowed opacity-50"

  return (
    <>
      <Button
        size="sm"
        variant={build.viewerHasLiked ? "default" : "outline"}
        onClick={isOwner ? undefined : onLike}
        aria-disabled={isOwner || undefined}
        className={cn(ownerLocked)}
        aria-pressed={build.viewerHasLiked}
        aria-label={`Like (${build.likeCount})`}
        title={isOwner ? "You can't like your own build" : undefined}
      >
        <Heart
          data-icon="inline-start"
          className={cn(build.viewerHasLiked && "fill-current")}
        />
        <span className="tabular-nums">{build.likeCount}</span>
      </Button>
      <Button
        size="sm"
        variant={build.viewerHasDisliked ? "default" : "outline"}
        onClick={isOwner ? undefined : onDislike}
        aria-disabled={isOwner || undefined}
        className={cn(ownerLocked)}
        aria-pressed={build.viewerHasDisliked}
        aria-label={`Dislike (${build.dislikeCount})`}
        title={isOwner ? "You can't dislike your own build" : undefined}
      >
        <ThumbsDown
          data-icon="inline-start"
          className={cn(build.viewerHasDisliked && "fill-current")}
        />
        <span className="tabular-nums">{build.dislikeCount}</span>
      </Button>
      <Button
        size="sm"
        variant={build.viewerHasBookmarked ? "default" : "outline"}
        onClick={onBookmark}
        aria-pressed={build.viewerHasBookmarked}
        aria-label={`Bookmark (${build.bookmarkCount})`}
      >
        <Bookmark
          data-icon="inline-start"
          className={cn(build.viewerHasBookmarked && "fill-current")}
        />
        <span className="tabular-nums">{build.bookmarkCount}</span>
      </Button>
    </>
  )
}
