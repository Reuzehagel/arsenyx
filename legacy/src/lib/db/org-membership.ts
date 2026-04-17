import "server-only"
import { cache } from "react"

import { prisma } from "../db"

export const isOrgMember = cache(async function isOrgMember(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  })
  return !!member
})
