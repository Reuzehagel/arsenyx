import type { OrgDirectoryItem } from "@arsenyx/shared/api/orgs"

import type { Prisma } from "../generated/prisma/client"

/** One org card's columns, shared by the public directory and the admin
 *  list. `builds` is the build count's filter (`true` = every build). */
export function orgDirectorySelect(
  builds: true | { where: Prisma.BuildWhereInput },
) {
  return {
    id: true,
    name: true,
    slug: true,
    image: true,
    description: true,
    verified: true,
    createdAt: true,
    _count: { select: { members: true, builds } },
  } as const
}

type OrgDirectoryRow = {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
  verified: boolean
  createdAt: Date
  _count: { members: number; builds: number }
}

export function toOrgDirectoryItem(o: OrgDirectoryRow): OrgDirectoryItem {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    image: o.image,
    description: o.description,
    verified: o.verified,
    createdAt: o.createdAt.toISOString(),
    memberCount: o._count.members,
    buildCount: o._count.builds,
  }
}
