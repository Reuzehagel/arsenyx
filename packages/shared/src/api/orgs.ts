// Wire shapes for organizations (apps/api routes/orgs.ts). Dates are ISO
// strings on the wire (see build-dto.ts).

import type { DirectoryEnvelope, PublicUser } from "./users"

export type OrgRole = "ADMIN" | "MEMBER"

export type OrgSummary = {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
  verified: boolean
}

export type OrgMember = {
  role: OrgRole
  joinedAt: string
  user: PublicUser
}

/** `GET /orgs/:slug`. */
export type OrgProfile = OrgSummary & {
  createdAt: string
  members: OrgMember[]
  buildCount: number
  viewer: {
    role: OrgRole | null
    isAdmin: boolean
  }
}

/** `GET /orgs` (the signed-in user's memberships). */
export type MyOrgsResponse = {
  memberships: Array<{
    role: OrgRole
    organization: OrgSummary
  }>
}

export type OrgDirectoryItem = OrgSummary & {
  createdAt: string
  memberCount: number
  buildCount: number
}

/** `GET /orgs/public`. */
export type OrgDirectoryResponse = DirectoryEnvelope & {
  orgs: OrgDirectoryItem[]
}
