/**
 * Build Database Operations
 *
 * CRUD operations for builds with visibility checks
 */

import { prisma } from "../db";
import { nanoid } from "nanoid";
import type { BuildVisibility, Prisma } from "@prisma/client";
import type { BuildState } from "@/lib/warframe/types";

// =============================================================================
// TYPES
// =============================================================================

export interface CreateBuildInput {
    itemUniqueName: string;
    name: string;
    description?: string;
    visibility?: BuildVisibility;
    buildData: BuildState;
    guide?: string; // Serialized Lexical state
}

export interface UpdateBuildInput {
    name?: string;
    description?: string;
    visibility?: BuildVisibility;
    buildData?: BuildState;
    guide?: string;
}

export interface BuildWithUser {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    visibility: BuildVisibility;
    buildData: BuildState;
    voteCount: number;
    favoriteCount: number;
    viewCount: number;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    user: {
        id: string;
        name: string | null;
        username: string | null;
        image: string | null;
    };
    item: {
        id: string;
        uniqueName: string;
        name: string;
        imageName: string | null;
        browseCategory: string;
    };
    // Guide
    buildGuide: {
        content: Record<string, unknown>;
        updatedAt: Date;
    } | null;
}

export interface GetBuildsOptions {
    page?: number;
    limit?: number;
    sortBy?: "newest" | "votes" | "views" | "updated";
    category?: string;
}

// =============================================================================
// SLUG GENERATION
// =============================================================================

/**
 * Generate a unique URL-friendly slug for a build
 * Uses nanoid with a custom alphabet for readability
 */
export function generateSlug(): string {
    // Use 10 characters - gives us 64^10 = ~1 quintillion unique combinations
    // Custom alphabet avoids confusing characters like 0/O, 1/l
    return nanoid(10);
}

/**
 * Generate a slug and ensure it's unique in the database
 */
async function generateUniqueSlug(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        const slug = generateSlug();
        const existing = await prisma.build.findUnique({
            where: { slug },
            select: { id: true },
        });

        if (!existing) {
            return slug;
        }

        attempts++;
    }

    // Fallback: use cuid if nanoid keeps colliding (extremely unlikely)
    throw new Error("Failed to generate unique slug after multiple attempts");
}

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new build
 */
export async function createBuild(
    userId: string,
    input: CreateBuildInput
): Promise<BuildWithUser> {
    // Find the item by uniqueName
    const item = await prisma.item.findUnique({
        where: { uniqueName: input.itemUniqueName },
        select: { id: true },
    });

    if (!item) {
        throw new Error(`Item not found: ${input.itemUniqueName}`);
    }

    const slug = await generateUniqueSlug();

    const build = await prisma.build.create({
        data: {
            slug,
            userId,
            itemId: item.id,
            name: input.name,
            description: input.description,
            visibility: input.visibility ?? "PUBLIC",
            buildData: input.buildData as unknown as Prisma.JsonObject,
            hasShards: false, // TODO: Detect from buildData when shards are implemented
            buildGuide: input.guide ? {
                create: {
                    content: JSON.parse(input.guide),
                }
            } : undefined,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    image: true,
                },
            },
            item: {
                select: {
                    id: true,
                    uniqueName: true,
                    name: true,
                    imageName: true,
                    browseCategory: true,
                },
            },
            buildGuide: {
                select: {
                    content: true,
                    updatedAt: true,
                },
            },
        },
    });

    return {
        ...build,
        buildData: build.buildData as unknown as BuildState,
    };
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get a build by its slug with visibility checks
 * @param slug - The build's URL slug
 * @param viewerId - Optional ID of the user viewing (for visibility checks)
 */
export async function getBuildBySlug(
    slug: string,
    viewerId?: string
): Promise<BuildWithUser | null> {
    const build = await prisma.build.findUnique({
        where: { slug },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    image: true,
                },
            },
            item: {
                select: {
                    id: true,
                    uniqueName: true,
                    name: true,
                    imageName: true,
                    browseCategory: true,
                },
            },
            buildGuide: {
                select: {
                    content: true,
                    updatedAt: true,
                },
            },
        },
    });

    if (!build) {
        return null;
    }

    // Visibility check
    if (!canViewBuild(build, viewerId)) {
        return null;
    }

    return {
        ...build,
        buildData: build.buildData as unknown as BuildState,
    };
}

/**
 * Get a build by its ID with visibility checks
 */
export async function getBuildById(
    id: string,
    viewerId?: string
): Promise<BuildWithUser | null> {
    const build = await prisma.build.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    image: true,
                },
            },
            item: {
                select: {
                    id: true,
                    uniqueName: true,
                    name: true,
                    imageName: true,
                    browseCategory: true,
                },
            },
            buildGuide: {
                select: {
                    content: true,
                    updatedAt: true,
                },
            },
        },
    });

    if (!build) {
        return null;
    }

    // Visibility check
    if (!canViewBuild(build, viewerId)) {
        return null;
    }

    return {
        ...build,
        buildData: build.buildData as unknown as BuildState,
    };
}

/**
 * Get all builds for a user (with visibility filtering for non-owners)
 */
export async function getUserBuilds(
    userId: string,
    viewerId?: string,
    options: GetBuildsOptions = {}
): Promise<{ builds: BuildWithUser[]; total: number }> {
    const { page = 1, limit = 20, sortBy = "newest" } = options;
    const skip = (page - 1) * limit;

    // If viewer is the owner, show all builds
    // Otherwise, only show public/unlisted builds
    const isOwner = viewerId === userId;
    const visibilityFilter: Prisma.BuildWhereInput = isOwner
        ? {}
        : { visibility: { in: ["PUBLIC", "UNLISTED"] } };

    const [builds, total] = await Promise.all([
        prisma.build.findMany({
            where: {
                userId,
                ...visibilityFilter,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        image: true,
                    },
                },
                item: {
                    select: {
                        id: true,
                        uniqueName: true,
                        name: true,
                        imageName: true,
                        browseCategory: true,
                    },
                },
                buildGuide: {
                    select: {
                        content: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: getOrderBy(sortBy),
            skip,
            take: limit,
        }),
        prisma.build.count({
            where: {
                userId,
                ...visibilityFilter,
            },
        }),
    ]);

    return {
        builds: builds.map((b) => ({
            ...b,
            buildData: b.buildData as unknown as BuildState,
        })),
        total,
    };
}

/**
 * Get public builds for a specific item
 */
export async function getPublicBuildsForItem(
    itemUniqueName: string,
    options: GetBuildsOptions = {}
): Promise<{ builds: BuildWithUser[]; total: number }> {
    const { page = 1, limit = 20, sortBy = "popular" } = options;
    const skip = (page - 1) * limit;

    // Find the item first
    const item = await prisma.item.findUnique({
        where: { uniqueName: itemUniqueName },
        select: { id: true },
    });

    if (!item) {
        return { builds: [], total: 0 };
    }

    const [builds, total] = await Promise.all([
        prisma.build.findMany({
            where: {
                itemId: item.id,
                visibility: "PUBLIC",
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        image: true,
                    },
                },
                item: {
                    select: {
                        id: true,
                        uniqueName: true,
                        name: true,
                        imageName: true,
                        browseCategory: true,
                    },
                },
                buildGuide: {
                    select: {
                        content: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: getOrderBy(sortBy),
            skip,
            take: limit,
        }),
        prisma.build.count({
            where: {
                itemId: item.id,
                visibility: "PUBLIC",
            },
        }),
    ]);

    return {
        builds: builds.map((b) => ({
            ...b,
            buildData: b.buildData as unknown as BuildState,
        })),
        total,
    };
}

/**
 * Get all public builds with optional category filter
 */
export async function getPublicBuilds(
    options: GetBuildsOptions = {}
): Promise<{ builds: BuildWithUser[]; total: number }> {
    const { page = 1, limit = 20, sortBy = "newest", category } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.BuildWhereInput = {
        visibility: "PUBLIC",
        ...(category && {
            item: {
                browseCategory: category,
            },
        }),
    };

    const [builds, total] = await Promise.all([
        prisma.build.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        image: true,
                    },
                },
                item: {
                    select: {
                        id: true,
                        uniqueName: true,
                        name: true,
                        imageName: true,
                        browseCategory: true,
                    },
                },
                buildGuide: {
                    select: {
                        content: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: getOrderBy(sortBy),
            skip,
            take: limit,
        }),
        prisma.build.count({ where }),
    ]);

    return {
        builds: builds.map((b) => ({
            ...b,
            buildData: b.buildData as unknown as BuildState,
        })),
        total,
    };
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update a build (owner only)
 */
export async function updateBuild(
    buildId: string,
    userId: string,
    input: UpdateBuildInput
): Promise<BuildWithUser> {
    // First verify ownership
    const existing = await prisma.build.findUnique({
        where: { id: buildId },
        select: { userId: true },
    });

    if (!existing) {
        throw new Error("Build not found");
    }

    if (existing.userId !== userId) {
        throw new Error("Not authorized to update this build");
    }

    const updateData: Prisma.BuildUpdateInput = {};

    if (input.name !== undefined) {
        updateData.name = input.name;
    }
    if (input.description !== undefined) {
        updateData.description = input.description;
    }
    if (input.visibility !== undefined) {
        updateData.visibility = input.visibility;
    }
    if (input.buildData !== undefined) {
        updateData.buildData = input.buildData as unknown as Prisma.JsonObject;
    }

    if (input.guide !== undefined) {
        updateData.buildGuide = {
            upsert: {
                create: {
                    content: JSON.parse(input.guide),
                },
                update: {
                    content: JSON.parse(input.guide),
                },
            },
        };
    }

    const build = await prisma.build.update({
        where: { id: buildId },
        data: updateData,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    image: true,
                },
            },
            item: {
                select: {
                    id: true,
                    uniqueName: true,
                    name: true,
                    imageName: true,
                    browseCategory: true,
                },
            },
            buildGuide: {
                select: {
                    content: true,
                    updatedAt: true,
                },
            },
        },
    });

    return {
        ...build,
        buildData: build.buildData as unknown as BuildState,
    };
}

/**
 * Increment the view count for a build
 */
export async function incrementBuildViewCount(buildId: string): Promise<void> {
    await prisma.build.update({
        where: { id: buildId },
        data: {
            viewCount: { increment: 1 },
        },
    });
}

// =============================================================================
// DELETE
// =============================================================================

/**
 * Delete a build (owner only)
 */
export async function deleteBuild(
    buildId: string,
    userId: string
): Promise<void> {
    // First verify ownership
    const existing = await prisma.build.findUnique({
        where: { id: buildId },
        select: { userId: true },
    });

    if (!existing) {
        throw new Error("Build not found");
    }

    if (existing.userId !== userId) {
        throw new Error("Not authorized to delete this build");
    }

    await prisma.build.delete({
        where: { id: buildId },
    });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a user can view a build based on visibility
 */
function canViewBuild(
    build: { visibility: BuildVisibility; userId: string },
    viewerId?: string
): boolean {
    // Owner can always view
    if (viewerId && build.userId === viewerId) {
        return true;
    }

    // Public and unlisted builds are viewable by anyone
    if (build.visibility === "PUBLIC" || build.visibility === "UNLISTED") {
        return true;
    }

    // Private builds are only viewable by owner
    return false;
}

/**
 * Get Prisma orderBy clause from sort option
 */
function getOrderBy(
    sortBy: "newest" | "votes" | "views" | "updated"
): Prisma.BuildOrderByWithRelationInput {
    switch (sortBy) {
        case "votes":
            return { voteCount: "desc" };
        case "views":
            return { viewCount: "desc" };
        case "updated":
            return { updatedAt: "desc" };
        case "newest":
        default:
            return { createdAt: "desc" };
    }
}
