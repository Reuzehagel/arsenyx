"use server"

/**
 * Build Server Actions
 *
 * Authenticated actions for build CRUD operations
 */

import type { BuildVisibility } from "@prisma/client"
import { after } from "next/server"

import { getServerSession } from "@/lib/auth"
import {
  createBuild,
  updateBuild,
  deleteBuild,
  getUserBuildsForPartnerSelector,
  type CreateBuildInput,
  type UpdateBuildInput,
  type BuildWithUser,
  incrementBuildViewCount,
} from "@/lib/db/index"
import { ok, err, getErrorMessage, type Result } from "@/lib/result"
import type { BuildState } from "@/lib/warframe/types"

// =============================================================================
// TYPES
// =============================================================================

export interface SaveBuildInput {
  buildId?: string // If provided, update existing build
  organizationId?: string
  itemUniqueName: string
  name: string
  description?: string
  visibility?: BuildVisibility
  buildData: BuildState
  guideSummary?: string
  guideDescription?: string
  partnerBuildIds?: string[]
}

export type SaveBuildResult = Result<BuildWithUser>
export type DeleteBuildResult = Result<void>

// =============================================================================
// SAVE BUILD (Create or Update)
// =============================================================================

/**
 * Save a build to the database (create or update)
 */
export async function saveBuildAction(
  input: SaveBuildInput,
): Promise<SaveBuildResult> {
  try {
    const session = await getServerSession()

    if (!session?.user?.id) {
      return err("You must be signed in to save a build")
    }

    const userId = session.user.id

    // Validate org membership if publishing under an org
    if (input.organizationId) {
      const { isOrgMember } = await import("@/lib/db/organizations")
      const isMember = await isOrgMember(input.organizationId, userId)
      if (!isMember) {
        return err("You are not a member of this organization")
      }
    }

    // If buildId is provided, update existing build
    if (input.buildId) {
      const updateData: UpdateBuildInput = {
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        buildData: input.buildData,
      }

      const build = await updateBuild(input.buildId, userId, updateData)
      return ok(build)
    }

    // Create new build
    const createData: CreateBuildInput = {
      organizationId: input.organizationId,
      itemUniqueName: input.itemUniqueName,
      name: input.name,
      description: input.description,
      visibility: input.visibility ?? "PUBLIC",
      buildData: input.buildData,
      guideSummary: input.guideSummary,
      guideDescription: input.guideDescription,
      partnerBuildIds: input.partnerBuildIds,
    }

    const build = await createBuild(userId, createData)
    return ok(build)
  } catch (error) {
    console.error("Failed to save build:", error)
    return err(getErrorMessage(error, "Failed to save build"))
  }
}

// =============================================================================
// DELETE BUILD
// =============================================================================

/**
 * Delete a build from the database (owner only)
 */
export async function deleteBuildAction(
  buildId: string,
): Promise<DeleteBuildResult> {
  try {
    const session = await getServerSession()

    if (!session?.user?.id) {
      return err("You must be signed in to delete a build")
    }

    await deleteBuild(buildId, session.user.id)
    return ok()
  } catch (error) {
    console.error("Failed to delete build:", error)
    return err(getErrorMessage(error, "Failed to delete build"))
  }
}

// =============================================================================
// FORK BUILD (Stub for future implementation)
// =============================================================================

/** Fork (copy) a public build to the current user's account — not yet implemented */
export async function forkBuildAction(
  _buildId: string,
): Promise<SaveBuildResult> {
  void _buildId
  return err("Fork functionality not yet implemented")
}

// =============================================================================
// VIEW COUNT
// =============================================================================

/**
 * Increment view count for a build
 * Safe to call from client - handles its own errors silently
 */
export async function incrementViewCountAction(buildId: string): Promise<void> {
  after(async () => {
    try {
      await incrementBuildViewCount(buildId)
    } catch {
      // Silently fail for analytics
    }
  })
}

// =============================================================================
// GUIDE UPDATE
// =============================================================================

export interface UpdateBuildGuideInput {
  summary?: string
  description?: string
  partnerBuildIds?: string[]
}

const MAX_SUMMARY_LENGTH = 400
const MAX_PARTNER_BUILDS = 10

/**
 * Update a build's guide content (summary, description, partner builds)
 */
export async function updateBuildGuideAction(
  buildId: string,
  input: UpdateBuildGuideInput,
): Promise<SaveBuildResult> {
  try {
    const session = await getServerSession()

    if (!session?.user?.id) {
      return err("You must be signed in to update a guide")
    }

    const userId = session.user.id

    // Validate summary length
    if (input.summary && input.summary.length > MAX_SUMMARY_LENGTH) {
      return err(`Summary must be ${MAX_SUMMARY_LENGTH} characters or less`)
    }

    // Validate partner builds count
    if (
      input.partnerBuildIds &&
      input.partnerBuildIds.length > MAX_PARTNER_BUILDS
    ) {
      return err(`Maximum ${MAX_PARTNER_BUILDS} partner builds allowed`)
    }

    const build = await updateBuild(buildId, userId, {
      guideSummary: input.summary,
      guideDescription: input.description,
      partnerBuildIds: input.partnerBuildIds,
    })

    return ok(build)
  } catch (error) {
    console.error("Failed to update guide:", error)
    return err(getErrorMessage(error, "Failed to update guide"))
  }
}

// =============================================================================
// PARTNER BUILD SELECTOR
// =============================================================================

/**
 * Get user's builds for partner build selector
 */
type PartnerSelectorBuilds = Awaited<
  ReturnType<typeof getUserBuildsForPartnerSelector>
>

export async function getUserBuildsForPartnerSelectorAction(): Promise<
  Result<PartnerSelectorBuilds>
> {
  try {
    const session = await getServerSession()

    if (!session?.user?.id) {
      return err("You must be signed in")
    }

    const builds = await getUserBuildsForPartnerSelector(session.user.id)
    return ok(builds)
  } catch (error) {
    console.error("Failed to get builds for partner selector:", error)
    return err(getErrorMessage(error, "Failed to get builds"))
  }
}
