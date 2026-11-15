// Wire shapes for organizations (apps/api routes/orgs.ts). Dates are ISO
// strings on the wire (see build-dto.ts).

import type { BuildItemSummary } from "./build-dto"
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

/** Who besides an org's admins may delete its builds (org settings). */
export type OrgBuildDeletion = {
  /** A member may delete, or move out of the org, the builds they authored. */
  membersDeleteOwnBuilds: boolean
  /** Minutes after a build joins the org that its author may still take it
   *  back; 0 is none. */
  authorGraceMinutes: number
}

/** `GET /orgs/:slug`. */
export type OrgProfile = OrgSummary & {
  createdAt: string
  buildDeletion: OrgBuildDeletion
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

/** A build deleted from an org that its admins can still restore. */
export type OrgDeletedBuild = {
  /** The deletion's id: what `POST …/deleted-builds/:id/restore` takes. */
  id: string
  slug: string
  name: string
  item: BuildItemSummary
  /** Null once the author's account is gone. */
  author: PublicUser | null
  /** Null once the deleter's account is gone. */
  deletedBy: PublicUser | null
  deletedAt: string
  /** Likes saved with it (deletions from before they were saved have none). */
  likeCount: number
}

/** `GET /orgs/:slug/deleted-builds` (org admins only): the org's builds
 *  deleted within the restore window and not back yet, newest first. */
export type OrgDeletedBuildsResponse = {
  builds: OrgDeletedBuild[]
}
