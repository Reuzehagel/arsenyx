// Wire shapes for the admin console (apps/api routes/admin.ts). Dates are ISO
// strings on the wire (see build-dto.ts).

import type { BuildListResponse } from "./build-dto"
import type { OrgDirectoryItem } from "./orgs"
import type { DirectoryEnvelope, PublicUser } from "./users"

export type AdminUser = PublicUser & {
  email: string
  createdAt: string
  isVerified: boolean
  isCommunityLeader: boolean
  isModerator: boolean
  isAdmin: boolean
  isBanned: boolean
  buildCount: number
}

export type AdminUserFlag =
  | "isVerified"
  | "isCommunityLeader"
  | "isModerator"
  | "isAdmin"
  | "isBanned"

/** `GET /admin/users`. */
export type AdminUsersResponse = DirectoryEnvelope & { users: AdminUser[] }

/** `GET /admin/builds` — the shared build list, authors always revealed. */
export type AdminBuildsResponse = BuildListResponse

export type AdminOrg = OrgDirectoryItem

/** `GET /admin/orgs`. */
export type AdminOrgsResponse = DirectoryEnvelope & { orgs: AdminOrg[] }

/** `GET /admin/stats`. */
export type AdminStats = {
  userCount: number
  orgCount: number
  buildCount: number
  buildsDay: number
  buildsWeek: number
  buildsMonth: number
  buildsByCategory: Array<{ category: string; count: number }>
}
