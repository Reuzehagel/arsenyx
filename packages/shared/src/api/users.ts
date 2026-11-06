// Wire shapes for profiles and the public directories (apps/api routes/users.ts,
// routes/orgs.ts). Dates are ISO strings on the wire (see build-dto.ts).

import type { OrgRole, OrgSummary } from "./orgs"

/** The public face of an account: what any viewer may see of an author or
 *  member. */
export type PublicUser = {
  id: string
  name: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
}

/** Pagination envelope shared by the two public directories. */
export type DirectoryEnvelope = {
  total: number
  page: number
  limit: number
}

export type ProfileBadges = {
  verified: boolean
  communityLeader: boolean
  moderator: boolean
  admin: boolean
}

export type ProfileStats = {
  buildCount: number
  totalLikes: number
  totalBookmarks: number
  totalViews: number
}

export type ProfileOrg = Omit<OrgSummary, "description"> & { role: OrgRole }

/** `GET /users/:username`. */
export type Profile = PublicUser & {
  bio: string | null
  joinedAt: string
  badges: ProfileBadges
  stats: ProfileStats
  orgs: ProfileOrg[]
}

export type ProfileDirectoryItem = PublicUser & {
  bio: string | null
  joinedAt: string
  badges: ProfileBadges
  buildCount: number
}

/** `GET /users`. */
export type ProfileDirectoryResponse = DirectoryEnvelope & {
  users: ProfileDirectoryItem[]
}
