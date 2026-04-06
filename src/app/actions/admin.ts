"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth-helpers"
import {
  adminUpdateUserRoles,
  adminBanUser,
  adminUnbanUser,
  adminDeleteUser,
  adminDeleteBuild,
} from "@/lib/db/index"
import { ok, err, getErrorMessage, type Result } from "@/lib/result"

// =============================================================================
// USER ACTIONS
// =============================================================================

export async function adminUpdateUserRoleAction(
  userId: string,
  flags: {
    isVerified?: boolean
    isCommunityLeader?: boolean
    isModerator?: boolean
    isAdmin?: boolean
  },
): Promise<Result> {
  try {
    const auth = await requireAdmin("update user roles")
    if (!auth.success) return auth

    // Prevent self-demotion
    if (userId === auth.data && flags.isAdmin === false) {
      return err("Cannot remove your own admin role")
    }

    await adminUpdateUserRoles(userId, flags)
    revalidatePath("/admin")
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to update user roles"))
  }
}

export async function adminBanUserAction(userId: string): Promise<Result> {
  try {
    const auth = await requireAdmin("ban user")
    if (!auth.success) return auth

    if (userId === auth.data) {
      return err("Cannot ban yourself")
    }

    await adminBanUser(userId)
    revalidatePath("/admin")
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to ban user"))
  }
}

export async function adminUnbanUserAction(userId: string): Promise<Result> {
  try {
    const auth = await requireAdmin("unban user")
    if (!auth.success) return auth

    await adminUnbanUser(userId)
    revalidatePath("/admin")
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to unban user"))
  }
}

export async function adminDeleteUserAction(userId: string): Promise<Result> {
  try {
    const auth = await requireAdmin("delete user")
    if (!auth.success) return auth

    if (userId === auth.data) {
      return err("Cannot delete your own account")
    }

    await adminDeleteUser(userId)
    revalidatePath("/admin")
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to delete user"))
  }
}

// =============================================================================
// BUILD ACTIONS
// =============================================================================

export async function adminDeleteBuildAction(buildId: string): Promise<Result> {
  try {
    const auth = await requireAdmin("delete build")
    if (!auth.success) return auth

    await adminDeleteBuild(buildId)
    revalidatePath("/admin")
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to delete build"))
  }
}
