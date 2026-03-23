"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth, getServerSession } from "@/lib/auth"
import { isUsernameTaken, updateUserBio } from "@/lib/db"
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
  bio: z.string().max(300, "Bio must be at most 300 characters").optional().or(z.literal("")),
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
      return err(parsed.error.errors[0]?.message ?? "Invalid input")
    }

    const { username, bio } = parsed.data
    const oldUsername = session.user.username

    // Update username via Better Auth API (keeps session in sync)
    if (username && username.toLowerCase() !== oldUsername?.toLowerCase()) {
      const taken = await isUsernameTaken(username, session.user.id)
      if (taken) {
        return err("Username is already taken")
      }

      await auth.api.updateUser({
        body: {
          username: username,
        },
        headers: await headers(),
      })
    }

    // Update bio directly (not managed by Better Auth)
    if (bio !== undefined) {
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
