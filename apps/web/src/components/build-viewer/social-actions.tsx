import { useNavigate } from "@tanstack/react-router"
import { Bookmark, Heart, ThumbsDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import type { BuildDetail } from "@/lib/queries/build-query"
import { useSetLike, useToggleBookmark } from "@/lib/queries/build-social"
import { cn } from "@/lib/util/utils"

/**
 * Like / dislike / bookmark buttons. All require auth (redirects to
 * /auth/signin for anonymous users); owners can't like or dislike their own
 * build.
 */
export function SocialActions({ build }: { build: BuildDetail }) {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const like = useSetLike(build.slug)
  const bookmark = useToggleBookmark(build.slug)
  const isOwner = build.isOwner

  const requireAuthThen = (run: () => void) => () => {
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    run()
  }

  const onLike = requireAuthThen(() =>
    like.mutate(build.viewerHasLiked ? 0 : 1),
  )
  const onDislike = requireAuthThen(() =>
    like.mutate(build.viewerHasDisliked ? 0 : -1),
  )
  const onBookmark = requireAuthThen(() =>
    bookmark.mutate(!build.viewerHasBookmarked),
  )

  return (
    <>
      <Button
        size="sm"
        variant={build.viewerHasLiked ? "default" : "outline"}
        onClick={onLike}
        disabled={isOwner || like.isPending}
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
        onClick={onDislike}
        disabled={isOwner || like.isPending}
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
        disabled={bookmark.isPending}
        aria-pressed={build.viewerHasBookmarked}
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
