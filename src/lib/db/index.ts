/**
 * Data Access Layer
 *
 * Provides unified access to Warframe data with feature flag support
 * to switch between static JSON files and database queries.
 *
 * Set USE_DATABASE=true in environment to use database
 */

export { prisma } from "../db";

// Re-export database query functions
export {
  getItemsByCategoryFromDb,
  getItemByUniqueNameFromDb,
  getItemBySlugFromDb,
  getCategoryCountsFromDb,
  searchItemsFromDb,
} from "./items";

export {
  getAllModsFromDb,
  getModsByCompatibilityFromDb,
  getModsForCategoryFromDb,
  getModByUniqueNameFromDb,
  getAllArcanesFromDb,
  getArcanesForSlotFromDb,
  searchModsFromDb,
} from "./mods";

export {
  createBuild,
  getBuildBySlug,
  getBuildById,
  updateBuild,
  deleteBuild,
  getUserBuilds,
  getPublicBuildsForItem,
  getPublicBuilds,
  incrementBuildViewCount,
  generateSlug,
  getUserBuildsForPartnerSelector,
} from "./builds";

export type {
  CreateBuildInput,
  UpdateBuildInput,
  BuildWithUser,
  GetBuildsOptions,
} from "./builds";

// Vote operations
export {
  toggleBuildVote,
  hasUserVotedForBuild,
  getUserVotesForBuilds,
} from "./votes";

export type { ToggleVoteResult } from "./votes";

// Favorite operations
export {
  toggleBuildFavorite,
  hasUserFavoritedBuild,
  getUserFavoriteBuilds,
  getUserFavoritesForBuilds,
} from "./favorites";

export type {
  ToggleFavoriteResult,
  FavoriteBuildWithDetails,
} from "./favorites";

// User operations
export {
  getUserByUsername,
  getUserById,
  getUserStats,
  getPublicBuildCountForUser,
} from "./users";

export type { UserProfile, UserStats } from "./users";

/**
 * Check if database mode is enabled
 */
export function useDatabase(): boolean {
  return process.env.USE_DATABASE === "true";
}
