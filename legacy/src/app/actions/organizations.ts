"use server"

import type { OrgRole } from "@/generated/prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAuth } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  addOrgMember,
  removeOrgMember,
  updateMemberRole,
  isOrgSlugTaken,
  isOrgAdmin,
  getUserOrganizations,
  getOrganizationBySlug,
  type OrganizationProfile,
  type OrganizationListItem,
} from "@/lib/db/organizations"
import { err, getErrorMessage, ok, type Result } from "@/lib/result"

// =============================================================================
// SCHEMAS
// =============================================================================

const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(30, "Slug must be at most 30 characters")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  image: z.string().url().optional().or(z.literal("")),
  description: z
    .string()
    .max(200, "Description must be at most 200 characters")
    .optional()
    .or(z.literal("")),
})

const updateOrgSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  image: z.string().url().nullable().optional(),
  description: z.string().max(200).nullable().optional(),
})

// =============================================================================
// CREATE
// =============================================================================

export async function createOrganizationAction(
  input: z.infer<typeof createOrgSchema>,
): Promise<Result<OrganizationProfile>> {
  try {
    const parsed = createOrgSchema.safeParse(input)
    if (!parsed.success)
      return err(parsed.error.issues[0]?.message ?? "Invalid input")

    const auth = await requireAuth("create an organization")
    if (!auth.success) return auth
    const userId = auth.data

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isCommunityLeader: true, isAdmin: true },
    })
    if (!user?.isCommunityLeader && !user?.isAdmin) {
      return err("You do not have permission to create organizations")
    }

    const slugTaken = await isOrgSlugTaken(parsed.data.slug)
    if (slugTaken) return err("This slug is already taken")

    const org = await createOrganization(userId, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      image: parsed.data.image || undefined,
      description: parsed.data.description || undefined,
    })

    revalidatePath("/settings")
    return ok(org)
  } catch (error) {
    return err(getErrorMessage(error, "Failed to create organization"))
  }
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateOrganizationAction(
  orgId: string,
  input: z.infer<typeof updateOrgSchema>,
): Promise<Result<OrganizationProfile>> {
  try {
    const parsed = updateOrgSchema.safeParse(input)
    if (!parsed.success)
      return err(parsed.error.issues[0]?.message ?? "Invalid input")

    const auth = await requireAuth("update an organization")
    if (!auth.success) return auth

    const admin = await isOrgAdmin(orgId, auth.data)
    if (!admin) return err("Only admins can update organization settings")

    if (parsed.data.slug) {
      const slugTaken = await isOrgSlugTaken(parsed.data.slug, orgId)
      if (slugTaken) return err("This slug is already taken")
    }

    const org = await updateOrganization(orgId, parsed.data)
    revalidatePath(`/org/${org.slug}`)
    return ok(org)
  } catch (error) {
    return err(getErrorMessage(error, "Failed to update organization"))
  }
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteOrganizationAction(orgId: string): Promise<Result> {
  try {
    const auth = await requireAuth("delete an organization")
    if (!auth.success) return auth

    const admin = await isOrgAdmin(orgId, auth.data)
    if (!admin) return err("Only admins can delete an organization")

    await deleteOrganization(orgId)
    revalidatePath("/settings")
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to delete organization"))
  }
}

// =============================================================================
// MEMBERS
// =============================================================================

export async function addOrgMemberAction(
  orgId: string,
  username: string,
): Promise<Result> {
  try {
    const auth = await requireAuth("add members")
    if (!auth.success) return auth

    const admin = await isOrgAdmin(orgId, auth.data)
    if (!admin) return err("Only admins can add members")

    await addOrgMember(orgId, username.trim())
    revalidatePath(`/org`)
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to add member"))
  }
}

export async function removeOrgMemberAction(
  orgId: string,
  userId: string,
): Promise<Result> {
  try {
    const auth = await requireAuth("remove members")
    if (!auth.success) return auth

    const admin = await isOrgAdmin(orgId, auth.data)
    if (!admin) return err("Only admins can remove members")

    await removeOrgMember(orgId, userId)
    revalidatePath(`/org`)
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to remove member"))
  }
}

export async function updateMemberRoleAction(
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<Result> {
  try {
    const auth = await requireAuth("change member roles")
    if (!auth.success) return auth

    const admin = await isOrgAdmin(orgId, auth.data)
    if (!admin) return err("Only admins can change member roles")

    await updateMemberRole(orgId, userId, role)
    revalidatePath(`/org`)
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to update member role"))
  }
}

// =============================================================================
// READ (for client use)
// =============================================================================

export async function getUserOrganizationsAction(): Promise<
  Result<OrganizationListItem[]>
> {
  try {
    const auth = await requireAuth("view organizations")
    if (!auth.success) return auth

    const orgs = await getUserOrganizations(auth.data)
    return ok(orgs)
  } catch (error) {
    return err(getErrorMessage(error, "Failed to load organizations"))
  }
}

export async function getOrganizationSettingsAction(
  slug: string,
): Promise<Result<OrganizationProfile>> {
  try {
    const auth = await requireAuth("access organization settings")
    if (!auth.success) return auth

    const org = await getOrganizationBySlug(slug)
    if (!org) return err("Organization not found")

    const admin = await isOrgAdmin(org.id, auth.data)
    if (!admin) return err("Only admins can access organization settings")

    return ok(org)
  } catch (error) {
    return err(getErrorMessage(error, "Failed to load organization"))
  }
}
