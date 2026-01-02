"use server";

/**
 * Social Feature Server Actions
 *
 * Vote and favorite operations with authentication
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  toggleBuildVote,
  hasUserVotedForBuild,
  toggleBuildFavorite,
  hasUserFavoritedBuild,
} from "@/lib/db/index";
import { RateLimitError } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";

// =============================================================================
// TYPES
// =============================================================================

export interface VoteResult {
  success: boolean;
  voted?: boolean;
  voteCount?: number;
  error?: string;
}

export interface FavoriteResult {
  success: boolean;
  favorited?: boolean;
  favoriteCount?: number;
  error?: string;
}

export interface SocialStatusResult {
  hasVoted: boolean;
  hasFavorited: boolean;
}

// =============================================================================
// VOTE ACTIONS
// =============================================================================

/**
 * Toggle vote on a build
 */
export async function toggleVoteAction(buildId: string): Promise<VoteResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be signed in to vote",
      };
    }

    const result = await toggleBuildVote(session.user.id, buildId);

    // Revalidate build page to show updated count
    revalidatePath(`/builds/[slug]`, "page");

    return {
      success: true,
      voted: result.voted,
      voteCount: result.voteCount,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: "Too many votes. Please wait a moment.",
      };
    }
    console.error("Failed to toggle vote:", error);
    return {
      success: false,
      error: "Failed to update vote",
    };
  }
}

// =============================================================================
// FAVORITE ACTIONS
// =============================================================================

/**
 * Toggle favorite on a build
 */
export async function toggleFavoriteAction(
  buildId: string
): Promise<FavoriteResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be signed in to save favorites",
      };
    }

    const result = await toggleBuildFavorite(session.user.id, buildId);

    // Revalidate relevant pages
    revalidatePath(`/builds/[slug]`, "page");
    revalidatePath("/favorites", "page");

    return {
      success: true,
      favorited: result.favorited,
      favoriteCount: result.favoriteCount,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: "Too many favorites. Please wait a moment.",
      };
    }
    console.error("Failed to toggle favorite:", error);
    return {
      success: false,
      error: "Failed to update favorite",
    };
  }
}

// =============================================================================
// STATUS CHECKS
// =============================================================================

/**
 * Get current user's vote and favorite status for a build
 */
export async function getSocialStatusAction(
  buildId: string
): Promise<SocialStatusResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { hasVoted: false, hasFavorited: false };
  }

  const [hasVoted, hasFavorited] = await Promise.all([
    hasUserVotedForBuild(session.user.id, buildId),
    hasUserFavoritedBuild(session.user.id, buildId),
  ]);

  return { hasVoted, hasFavorited };
}
