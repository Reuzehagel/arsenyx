/**
 * Build Social Actions Bar
 *
 * Server component that fetches initial vote/favorite state
 * and renders the interactive client components.
 */

import { Eye } from "lucide-react";
import { getServerSession } from "@/lib/auth";
import { hasUserVotedForBuild, hasUserFavoritedBuild } from "@/lib/db/index";
import { VoteButton } from "./vote-button";
import { FavoriteButton } from "./favorite-button";

interface BuildSocialActionsProps {
  buildId: string;
  voteCount: number;
  favoriteCount: number;
  viewCount: number;
}

export async function BuildSocialActions({
  buildId,
  voteCount,
  favoriteCount,
  viewCount,
}: BuildSocialActionsProps) {
  const session = await getServerSession();
  const userId = session?.user?.id;

  // Fetch initial social status
  let hasVoted = false;
  let hasFavorited = false;

  if (userId) {
    [hasVoted, hasFavorited] = await Promise.all([
      hasUserVotedForBuild(userId, buildId),
      hasUserFavoritedBuild(userId, buildId),
    ]);
  }

  return (
    <div className="flex items-center gap-1">
      <VoteButton
        buildId={buildId}
        initialVoteCount={voteCount}
        initialHasVoted={hasVoted}
      />
      <FavoriteButton
        buildId={buildId}
        initialFavoriteCount={favoriteCount}
        initialHasFavorited={hasFavorited}
      />
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground px-3 h-8">
        <Eye className="h-4 w-4" />
        <span className="tabular-nums">{viewCount}</span>
      </div>
    </div>
  );
}
