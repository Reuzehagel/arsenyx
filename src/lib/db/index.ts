export { prisma } from "../db"

// Build operations
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
} from "./builds"

export type {
  CreateBuildInput,
  UpdateBuildInput,
  BuildWithUser,
  BuildListItem,
  GetBuildsOptions,
} from "./builds"

// Vote operations
export {
  toggleBuildVote,
  hasUserVotedForBuild,
  getUserVotesForBuilds,
} from "./votes"

export type { ToggleVoteResult } from "./votes"

// Favorite operations
export {
  toggleBuildFavorite,
  hasUserFavoritedBuild,
  getUserFavoriteBuilds,
  getUserFavoritesForBuilds,
} from "./favorites"

export type {
  ToggleFavoriteResult,
  FavoriteBuildWithDetails,
} from "./favorites"

// User operations
export {
  getUserByUsername,
  getUserById,
  getUserStats,
  getPublicBuildCountForUser,
  getUserForSettings,
  updateUserBio,
  isUsernameTaken,
} from "./users"

export type { UserProfile, UserProfileFull, UserStats } from "./users"

// Organization operations
export {
  getOrganizationBySlug,
  getOrganizationById,
  isOrgMember,
  isOrgAdmin,
  getUserOrganizations,
  isOrgSlugTaken,
  createOrganization,
  updateOrganization,
  addOrgMember,
  removeOrgMember,
  updateMemberRole,
  deleteOrganization,
} from "./organizations"

export type {
  OrganizationProfile,
  OrganizationListItem,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "./organizations"
