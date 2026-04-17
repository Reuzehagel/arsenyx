"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"

import { auth, getServerSession } from "@/lib/auth"
import { requireAuth } from "@/lib/auth-helpers"
import {
  getPublicBuilds,
  getUserBuilds,
  getUserForSettings,
  isUsernameTaken,
  updateUserBio,
  type BuildListItem,
  type GetBuildsOptions,
  type UserProfileFull,
} from "@/lib/db/index"
import { profileLimiter, RateLimitError } from "@/lib/rate-limit"
import { err, getErrorMessage, ok, type Result } from "@/lib/result"

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Only letters, numbers, hyphens, and underscores",
    )
    .optional(),
  bio: z
    .string()
    .max(300, "Bio must be at most 300 characters")
    .optional()
    .or(z.literal("")),
})

type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export async function updateProfileAction(
  input: UpdateProfileInput,
): Promise<Result> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return err("You must be signed in to update your profile")
    }

    await profileLimiter.check(10, session.user.id)

    const parsed = updateProfileSchema.safeParse(input)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? "Invalid input")
    }

    const { username, bio } = parsed.data
    const oldUsername = session.user.username

    // Update username via Better Auth API (keeps session in sync)
    if (username && username.toLowerCase() !== oldUsername?.toLowerCase()) {
      const taken = await isUsernameTaken(username, session.user.id)
      if (taken) {
        return err("Username is already taken")
      }

      // Run username update and bio update in parallel
      const updates: Promise<unknown>[] = [
        auth.api.updateUser({
          body: { username: username },
          headers: await headers(),
        }),
      ]

      if (bio !== undefined) {
        updates.push(updateUserBio(session.user.id, bio || null))
      }

      await Promise.all(updates)
    } else if (bio !== undefined) {
      // Only bio changed
      await updateUserBio(session.user.id, bio || null)
    }

    // Revalidate profile and settings paths
    revalidatePath("/settings")
    if (oldUsername) {
      revalidatePath(`/profile/${oldUsername}`)
    }
    if (username && username.toLowerCase() !== oldUsername?.toLowerCase()) {
      revalidatePath(`/profile/${username.toLowerCase()}`)
    }

    return ok()
  } catch (error) {
    if (error instanceof RateLimitError) {
      return err("Too many requests. Please try again later.")
    }
    return err(getErrorMessage(error, "Failed to update profile"))
  }
}

// =============================================================================
// PROFILE / ORGANIZATION BUILDS
// =============================================================================

interface ProfileBuildsResult {
  builds: BuildListItem[]
  hasMore: boolean
}

async function fetchPaginatedBuilds(
  fetcher: (opts: GetBuildsOptions) => Promise<{ builds: BuildListItem[]; total: number }>,
  options: { query?: string; category?: string; page?: number; sortBy?: string },
  extraOptions?: Partial<GetBuildsOptions>,
): Promise<Result<ProfileBuildsResult>> {
  try {
    const limit = 12
    const page = options.page ?? 1
    const sortBy = (options.sortBy ?? "votes") as GetBuildsOptions["sortBy"]
    const buildOptions: GetBuildsOptions = {
      page,
      limit,
      sortBy,
      ...extraOptions,
      ...(options.query && { query: options.query }),
      ...(options.category &&
        options.category !== "all" && { category: options.category }),
    }

    const { builds, total } = await fetcher(buildOptions)
    const hasMore = total > page * limit

    return ok({ builds, hasMore })
  } catch (error) {
    return err(getErrorMessage(error, "Failed to load builds"))
  }
}

export async function getProfileBuildsAction(
  userId: string,
  options: { query?: string; category?: string; page?: number; sortBy?: string },
): Promise<Result<ProfileBuildsResult>> {
  const session = await getServerSession()
  const viewerId = session?.user?.id

  return fetchPaginatedBuilds(
    (opts) => getUserBuilds(userId, viewerId, opts),
    options,
  )
}

export async function getOrgBuildsAction(
  orgId: string,
  options: { query?: string; category?: string; page?: number; sortBy?: string },
): Promise<Result<ProfileBuildsResult>> {
  return fetchPaginatedBuilds(
    (opts) => getPublicBuilds(opts),
    options,
    { organizationId: orgId },
  )
}

// =============================================================================
// SETTINGS DATA
// =============================================================================

export async function getSettingsDataAction(): Promise<
  Result<UserProfileFull>
> {
  try {
    const auth = await requireAuth("view settings")
    if (!auth.success) return auth

    const user = await getUserForSettings(auth.data)
    if (!user) {
      return err("User not found")
    }

    return ok(user)
  } catch (error) {
    return err(getErrorMessage(error, "Failed to load settings"))
  }
}
