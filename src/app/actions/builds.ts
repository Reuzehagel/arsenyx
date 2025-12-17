"use server";

/**
 * Build Server Actions
 *
 * Authenticated actions for build CRUD operations
 */

import { auth } from "@/lib/auth";
import {
    createBuild,
    updateBuild,
    deleteBuild,
    getBuildById,
    type CreateBuildInput,
    type UpdateBuildInput,
    type BuildWithUser,
    incrementBuildViewCount,
} from "@/lib/db/index";
import type { BuildVisibility } from "@prisma/client";
import type { BuildState } from "@/lib/warframe/types";

// =============================================================================
// TYPES
// =============================================================================

export interface SaveBuildInput {
    buildId?: string; // If provided, update existing build
    itemUniqueName: string;
    name: string;
    description?: string;
    visibility?: BuildVisibility;
    buildData: BuildState;
    guide?: string;
}

export interface SaveBuildResult {
    success: boolean;
    build?: BuildWithUser;
    error?: string;
}

export interface DeleteBuildResult {
    success: boolean;
    error?: string;
}

// =============================================================================
// SAVE BUILD (Create or Update)
// =============================================================================

/**
 * Save a build to the database (create or update)
 */
export async function saveBuildAction(
    input: SaveBuildInput
): Promise<SaveBuildResult> {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return {
                success: false,
                error: "You must be signed in to save a build",
            };
        }

        const userId = session.user.id;

        // If buildId is provided, update existing build
        if (input.buildId) {
            // Verify ownership first
            const existing = await getBuildById(input.buildId, userId);

            if (!existing) {
                return {
                    success: false,
                    error: "Build not found",
                };
            }

            if (existing.userId !== userId) {
                return {
                    success: false,
                    error: "You are not authorized to update this build",
                };
            }

            const updateData: UpdateBuildInput = {
                name: input.name,
                description: input.description,
                visibility: input.visibility,
                buildData: input.buildData,
                guide: input.guide,
            };

            const build = await updateBuild(input.buildId, userId, updateData);

            return {
                success: true,
                build,
            };
        }

        // Create new build
        const createData: CreateBuildInput = {
            itemUniqueName: input.itemUniqueName,
            name: input.name,
            description: input.description,
            visibility: input.visibility ?? "PUBLIC",
            buildData: input.buildData,
            guide: input.guide,
        };

        const build = await createBuild(userId, createData);

        return {
            success: true,
            build,
        };
    } catch (error) {
        console.error("Failed to save build:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to save build",
        };
    }
}

// =============================================================================
// DELETE BUILD
// =============================================================================

/**
 * Delete a build from the database (owner only)
 */
export async function deleteBuildAction(
    buildId: string
): Promise<DeleteBuildResult> {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return {
                success: false,
                error: "You must be signed in to delete a build",
            };
        }

        await deleteBuild(buildId, session.user.id);

        return {
            success: true,
        };
    } catch (error) {
        console.error("Failed to delete build:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete build",
        };
    }
}

// =============================================================================
// FORK BUILD (Stub for future implementation)
// =============================================================================

/**
 * Fork (copy) a public build to the current user's account
 * TODO: Implement in Sprint 4
 */
export async function forkBuildAction(
    _buildId: string
): Promise<SaveBuildResult> {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return {
                success: false,
                error: "You must be signed in to fork a build",
            };
        }

        // TODO: Implement forking logic
        // 1. Get the source build (must be public or unlisted)
        // 2. Create a copy with forkedFromId set
        // 3. Return the new build

        return {
            success: false,
            error: "Fork functionality not yet implemented",
        };
    } catch (error) {
        console.error("Failed to fork build:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fork build",
        };
    }
}

// =============================================================================
// VIEW COUNT
// =============================================================================

/**
 * Increment view count for a build
 * Safe to call from client - handles its own errors silently
 */
export async function incrementViewCountAction(buildId: string): Promise<void> {
    try {
        await incrementBuildViewCount(buildId);
    } catch {
        // Silently fail for analytics
    }
}

// =============================================================================
// GUIDE UPDATE
// =============================================================================

/**
 * Update a build's guide content
 */
export async function updateBuildGuideAction(
    buildId: string,
    guideContent: string
): Promise<SaveBuildResult> {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return {
                success: false,
                error: "You must be signed in to update a guide",
            };
        }

        const userId = session.user.id;
        const exists = await getBuildById(buildId, userId);

        if (!exists) {
            return {
                success: false,
                error: "Build not found",
            };
        }

        if (exists.userId !== userId) {
            return {
                success: false,
                error: "You are not authorized to update this guide",
            };
        }

        // We can reuse updateBuild which handles the guide upsert logic
        const build = await updateBuild(buildId, userId, {
            guide: guideContent,
        });

        // Revalidate the page
        // Note: In a deeper implementation we might accept the path to revalidate
        // For now, client navigation or router.refresh() will handle the UI update

        return {
            success: true,
            build,
        };

    } catch (error) {
        console.error("Failed to update guide:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update guide",
        };
    }
}
