import "server-only"
import type { OrgRole } from "@/generated/prisma/client"
import { cache } from "react"

import { prisma } from "../db"
import { USER_SUMMARY_SELECT } from "./selects"

// =============================================================================
// TYPES
// =============================================================================

export interface OrganizationProfile {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
  createdAt: Date
  members: {
    userId: string
    role: OrgRole
    joinedAt: Date
    user: {
      id: string
      name: string | null
      username: string | null
      displayUsername: string | null
      image: string | null
    }
  }[]
}

export interface OrganizationListItem {
  id: string
  name: string
  slug: string
  image: string | null
  role: OrgRole
}

export interface CreateOrganizationInput {
  name: string
  slug: string
  image?: string
  description?: string
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  image?: string | null
  description?: string | null
}

// =============================================================================
// READ
// =============================================================================

const membersInclude = {
  include: {
    user: { select: USER_SUMMARY_SELECT },
  },
  orderBy: [{ role: "asc" as const }, { joinedAt: "asc" as const }],
}

async function getOrganizationByWhere(
  where: { slug: string } | { id: string },
): Promise<OrganizationProfile | null> {
  const org = await prisma.organization.findUnique({
    where,
    include: { members: membersInclude },
  })
  return org
}

export const getOrganizationBySlug = cache(function getOrganizationBySlug(
  slug: string,
): Promise<OrganizationProfile | null> {
  return getOrganizationByWhere({ slug })
})

export const getOrganizationById = cache(function getOrganizationById(
  id: string,
): Promise<OrganizationProfile | null> {
  return getOrganizationByWhere({ id })
})

export { isOrgMember } from "./org-membership"

export const isOrgAdmin = cache(async function isOrgAdmin(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  })
  return member?.role === "ADMIN"
})

export async function getUserOrganizations(
  userId: string,
): Promise<OrganizationListItem[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, image: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  })
  return memberships.map((m) => ({ ...m.organization, role: m.role }))
}

export async function isOrgSlugTaken(
  slug: string,
  excludeOrgId?: string,
): Promise<boolean> {
  const existing = await prisma.organization.findFirst({
    where: {
      slug: { equals: slug, mode: "insensitive" },
      ...(excludeOrgId && { id: { not: excludeOrgId } }),
    },
    select: { id: true },
  })
  return !!existing
}

// =============================================================================
// CREATE
// =============================================================================

export async function createOrganization(
  userId: string,
  input: CreateOrganizationInput,
): Promise<OrganizationProfile> {
  const org = await prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug.toLowerCase(),
      image: input.image ?? null,
      description: input.description ?? null,
      members: { create: { userId, role: "ADMIN" } },
    },
    include: {
      members: {
        include: { user: { select: USER_SUMMARY_SELECT } },
      },
    },
  })
  return org
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<OrganizationProfile> {
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug.toLowerCase() }),
      ...(input.image !== undefined && { image: input.image }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
    },
    include: {
      members: {
        include: { user: { select: USER_SUMMARY_SELECT } },
      },
    },
  })
  return org
}

// =============================================================================
// MEMBERS
// =============================================================================

export async function addOrgMember(
  orgId: string,
  username: string,
  role: OrgRole = "MEMBER",
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  })
  if (!user) throw new Error(`User "${username}" not found`)

  const existing = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: user.id },
    },
  })
  if (existing) throw new Error(`User "${username}" is already a member`)

  await prisma.organizationMember.create({
    data: { organizationId: orgId, userId: user.id, role },
  })
}

export async function removeOrgMember(
  orgId: string,
  userId: string,
): Promise<void> {
  const [adminCount, member] = await Promise.all([
    prisma.organizationMember.count({
      where: { organizationId: orgId, role: "ADMIN" },
    }),
    prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { role: true },
    }),
  ])
  if (member?.role === "ADMIN" && adminCount <= 1) {
    throw new Error("Cannot remove the last admin")
  }
  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  })
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<void> {
  if (role === "MEMBER") {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { role: true },
    })
    if (member?.role === "ADMIN") {
      const adminCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: "ADMIN" },
      })
      if (adminCount <= 1) throw new Error("Cannot demote the last admin")
    }
  }
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    data: { role },
  })
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteOrganization(orgId: string): Promise<void> {
  await prisma.$transaction([
    prisma.build.updateMany({
      where: { organizationId: orgId },
      data: { organizationId: null },
    }),
    prisma.organization.delete({ where: { id: orgId } }),
  ])
}
