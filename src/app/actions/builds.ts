"use server"

/**
 * Build Server Actions
 *
 * Authenticated actions for build CRUD operations
 */

import { revalidatePath } from "next/cache"
import { after } from "next/server"

import { getServerSession } from "@/lib/auth"
import { requireAuth } from "@/lib/auth-helpers"
import {
  BuildDraftError,
  normalizeBuildDraftForPersistence,
  type BuildDraftPayload,
} from "@/lib/builds"
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

// =============================================================================
// TYPES
// =============================================================================

export interface SaveBuildInput extends BuildDraftPayload {
  buildId?: string // If provided, update existing build
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
    const auth = await requireAuth("save a build")
    if (!auth.success) return auth
    const userId = auth.data
    const session = await getServerSession()
    const normalized = await normalizeBuildDraftForPersistence(
      {
        userId,
        isBanned: session?.user?.isBanned ?? false,
      },
      input,
      {
        existingBuildId: input.buildId,
      },
    )

    // If buildId is provided, update existing build
    if (input.buildId) {
      const updateData: UpdateBuildInput = {
        name: normalized.name,
        description: normalized.description,
        visibility: normalized.visibility,
        buildData: normalized.buildData,
        organizationId: normalized.organizationId,
        guideSummary: normalized.guideSummary,
        guideDescription: normalized.guideDescription,
        partnerBuildIds: normalized.partnerBuildIds,
      }

      const build = await updateBuild(input.buildId, userId, updateData)
      return ok(build)
    }

    // Create new build
    const createData: CreateBuildInput = {
      organizationId: normalized.organizationId ?? undefined,
      itemUniqueName: normalized.itemUniqueName,
      itemCategory: normalized.itemCategory,
      name: normalized.name,
      description: normalized.description,
      visibility: normalized.visibility,
      buildData: normalized.buildData,
      guideSummary: normalized.guideSummary ?? undefined,
      guideDescription: normalized.guideDescription ?? undefined,
      partnerBuildIds: normalized.partnerBuildIds,
    }

    const build = await createBuild(userId, createData)
    return ok(build)
  } catch (error) {
    if (error instanceof BuildDraftError) {
      const detail = error.field
        ? `${error.message} (field: ${error.field})`
        : error.message
      console.error("Build draft validation failed:", error.code, detail)
      return err(detail)
    }
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
    const auth = await requireAuth("delete a build")
    if (!auth.success) return auth

    await deleteBuild(buildId, auth.data)
    revalidatePath("/browse/[category]/[slug]", "page")
    revalidatePath("/builds", "page")
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
    const auth = await requireAuth("update a guide")
    if (!auth.success) return auth
    const userId = auth.data

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
    const auth = await requireAuth("view your builds")
    if (!auth.success) return auth

    const builds = await getUserBuildsForPartnerSelector(auth.data)
    return ok(builds)
  } catch (error) {
    console.error("Failed to get builds for partner selector:", error)
    return err(getErrorMessage(error, "Failed to get builds"))
  }
}
