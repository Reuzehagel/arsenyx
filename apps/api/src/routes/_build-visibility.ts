import type { Context } from "hono"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { BuildVisibility } from "../generated/prisma/enums"
import { isCurrentAdmin } from "../lib/session"

/**
 * Every Visibility / access rule for Builds: who may see, act on, or mutate a
 * single Build, and the scope of every Build list. Routes resolve the viewer
 * and call in here; they never restate a predicate.
 */

// ---------------------------------------------------------------------------
// Anonymous visibility
// ---------------------------------------------------------------------------

/** Visibilities anyone with the link may open. UNLISTED is "accessible by
 *  URL, not enumerable", so enumerating surfaces (lists, typeahead) use
 *  PUBLIC alone. */
const ANON_VISIBLE = [BuildVisibility.PUBLIC, BuildVisibility.UNLISTED]

export function isAnonVisible(visibility: string): boolean {
  return (ANON_VISIBLE as string[]).includes(visibility)
}

/** SQL list form, as literals: the values are enum constants, not input. */
const ANON_VISIBLE_SQL = Prisma.raw(
  ANON_VISIBLE.map((v) => `'${v}'`).join(", "),
)

/** Prisma form of {@link isAnonVisible}. */
const ANON_VISIBLE_WHERE = {
  visibility: { in: ANON_VISIBLE },
} satisfies Prisma.BuildWhereInput

// ---------------------------------------------------------------------------
// Per-Build access
// ---------------------------------------------------------------------------

type Owned = { userId: string; organizationId: string | null }
type AccessBuild = Owned & { visibility: BuildVisibility }
type Viewer = {
  id: string | undefined
  isOrgMember: boolean
  isAdmin?: boolean
}

const mayMutate = (build: { userId: string }, viewer: Viewer) =>
  viewer.id != null && (build.userId === viewer.id || viewer.isOrgMember)

/** Per-Build access for one viewer. `isOrgMember` is the viewer's membership
 *  in the Build's org (false when it has none). Admins may VIEW anything to
 *  moderate it, but never mutate or act on it (like/bookmark/fork). */
export function buildAccess(
  build: { userId: string; visibility: BuildVisibility },
  viewer: Viewer,
) {
  const canMutate = mayMutate(build, viewer)
  const canAct = isAnonVisible(build.visibility) || canMutate
  return { canMutate, canAct, canView: canAct || viewer.isAdmin === true }
}

/** Whether `userId` belongs to `organizationId`. The one membership lookup
 *  behind every access rule. */
export async function isOrgMember(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  })
  return membership != null
}

/** The viewer's membership in the Build's org, looked up only when it can
 *  change an answer: a signed-in viewer who isn't the author, on an org
 *  build. Anonymous viewers never query. */
async function memberOf(build: Owned, viewerId: string | undefined) {
  return (
    viewerId != null &&
    build.organizationId != null &&
    build.userId !== viewerId &&
    isOrgMember(build.organizationId, viewerId)
  )
}

/** {@link buildAccess} with membership resolved. */
export async function resolveAccess(
  build: AccessBuild,
  viewer: { id: string; isAdmin?: boolean } | undefined,
) {
  return buildAccess(build, {
    id: viewer?.id,
    isOrgMember: await memberOf(build, viewer?.id),
    isAdmin: viewer?.isAdmin,
  })
}

/** {@link resolveAccess} for the request's signed-in viewer, with the admin
 *  moderation bypass: a fresh admin may VIEW any Build (GET /builds/:slug and
 *  /:slug/partners) — without it, an admin who sets someone else's build to
 *  PRIVATE loses the right to view it back. Acting goes through
 *  {@link canActOnBuild}, which has no admin bypass. */
export async function viewerAccess(
  c: Context,
  build: AccessBuild,
  viewerId: string | undefined,
) {
  const isAdmin = viewerId != null && (await isCurrentAdmin(c))
  const access = await resolveAccess(
    build,
    viewerId ? { id: viewerId, isAdmin } : undefined,
  )
  return { ...access, isAdmin }
}

/** May this user edit / delete / relink the Build? Author or org member. */
export async function canMutateBuild(
  build: Owned,
  userId: string,
): Promise<boolean> {
  return mayMutate(build, {
    id: userId,
    isOrgMember: await memberOf(build, userId),
  })
}

/** May this viewer ACT on the Build (like / bookmark / fork / see its
 *  partners)? Deliberately no admin bypass: an admin may VIEW any build to
 *  moderate it (GET /builds/:slug), but must not like, bookmark or fork a
 *  PRIVATE build they don't own. */
export async function canActOnBuild(
  build: AccessBuild,
  viewerId: string | undefined,
): Promise<boolean> {
  if (isAnonVisible(build.visibility)) return true
  return (await resolveAccess(build, viewerId ? { id: viewerId } : undefined))
    .canAct
}

// ---------------------------------------------------------------------------
// Prisma scopes for single-shot finds (typeahead, partner strips, counts)
// ---------------------------------------------------------------------------

/** Typeahead (`GET /builds/search`): PUBLIC only — a typeahead is
 *  enumeration — plus the viewer's own builds at any visibility. */
export function searchScope(
  viewerId: string | undefined,
): Prisma.BuildWhereInput {
  return viewerId
    ? { OR: [{ visibility: BuildVisibility.PUBLIC }, { userId: viewerId }] }
    : { visibility: BuildVisibility.PUBLIC }
}

/** Every build `userId` may mutate: their own plus their orgs' (the partner
 *  picker's `mine=1`). */
export async function mutableScope(
  userId: string,
): Promise<Prisma.BuildWhereInput> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  })
  if (memberships.length === 0) return { userId }
  return {
    OR: [
      { userId },
      { organizationId: { in: memberships.map((m) => m.organizationId) } },
    ],
  }
}

/** Partners a viewer may see in a build's strip: anonymously visible ones,
 *  plus the viewer's own. Filtered in the DB so hidden partners' joined
 *  rows are never selected. */
export function visiblePartnerScope(
  viewerId: string | undefined,
): Prisma.BuildWhereInput {
  return viewerId
    ? { OR: [ANON_VISIBLE_WHERE, { userId: viewerId }] }
    : ANON_VISIBLE_WHERE
}

/** A Build that counts toward an Organization's public face: its directory
 *  card and profile build counts. Same rule as {@link orgPublicScope}. */
export const ORG_PUBLIC_BUILD = {
  visibility: BuildVisibility.PUBLIC,
} as const satisfies Prisma.BuildWhereInput

/** A Build that counts as its author's public work (see
 *  {@link userPublicScope} for the rule and why the OR is shaped this way).
 *  The profile directory (`GET /users`) filters and counts users by this, so
 *  it agrees with what the profile page lists. Compose it, don't restate it. */
export const AUTHORED_PUBLIC_BUILD = {
  visibility: BuildVisibility.PUBLIC,
  OR: [{ organizationId: null }, { hideAuthor: false }],
} as const satisfies Prisma.BuildWhereInput

// ---------------------------------------------------------------------------
// List scopes (runList's raw-SQL `baseFilter`)
// ---------------------------------------------------------------------------

/** Named to match runList's param so a route spreads a scope:
 *    runList({ filters, ...publicScope(), defaultSort: "newest" }) */
export interface ListScope {
  baseFilter: Prisma.Sql
}

/** PUBLIC Builds only — the global browse list (`GET /builds`). */
export function publicScope(): ListScope {
  return { baseFilter: Prisma.sql`visibility = 'PUBLIC'` }
}

/** Every Build owned by `userId`, at any Visibility — the owner's own list
 *  (`GET /builds/mine`). */
export function ownerScope(userId: string): ListScope {
  return { baseFilter: Prisma.sql`"userId" = ${userId}` }
}

/** Builds `userId` has bookmarked AND may still see: anonymously visible, or
 *  their own — never someone else's PRIVATE (`GET /builds/bookmarks`). Not
 *  {@link buildAccess}: an org member's bookmark of a PRIVATE org Build is
 *  dropped here though they may open it (pre-existing, kept as is). */
export function bookmarkedScope(userId: string): ListScope {
  return {
    baseFilter: Prisma.sql`
      EXISTS (
        SELECT 1 FROM build_bookmarks bb
        WHERE bb."buildId" = builds.id AND bb."userId" = ${userId}
      )
      AND (visibility IN (${ANON_VISIBLE_SQL}) OR "userId" = ${userId})
    `,
  }
}

/** A User's authored PUBLIC Builds — their public profile list and aggregate
 *  stats (`GET /users/:username[/builds]`); the SQL form of
 *  {@link AUTHORED_PUBLIC_BUILD} plus the userId. Org-published Builds count
 *  as the author's work and appear here too (#317; cards carry the org
 *  byline, so attribution stays unambiguous) — except when the Build sets
 *  `hideAuthor`, which exists to keep the author off an org Build. Listing
 *  those on the author's own profile would undo the flag.
 *
 *  The `organizationId IS NULL` half of the OR is not redundant with
 *  `hideAuthor = false`: before deleteOrganization reset the flag, deleting
 *  an Organization nulled `organizationId` (schema `onDelete: SetNull`) and
 *  left `hideAuthor = true` behind, and those rows still exist. A Build with
 *  no org has no org to hide behind — it belongs on its author's profile
 *  regardless of the flag. */
export function userPublicScope(userId: string): ListScope {
  return {
    baseFilter: Prisma.sql`"userId" = ${userId} AND visibility = 'PUBLIC' AND ("organizationId" IS NULL OR "hideAuthor" = false)`,
  }
}

/** An Organization's PUBLIC Builds — its public profile list
 *  (`GET /orgs/:slug/builds`). */
function orgPublicScope(organizationId: string): ListScope {
  return {
    baseFilter: Prisma.sql`"organizationId" = ${organizationId} AND visibility = 'PUBLIC'`,
  }
}

/** Every Build published under an Organization, at any Visibility — the org
 *  page as seen by the org's own members. Membership grants view access to
 *  the org's PRIVATE Builds (#274), same as {@link buildAccess}. */
function orgMemberScope(organizationId: string): ListScope {
  return { baseFilter: Prisma.sql`"organizationId" = ${organizationId}` }
}

/** No Visibility filter at all — the admin moderation list sees every Build
 *  regardless of Visibility (`GET /admin/builds`). Guarded by requireAdmin at
 *  the route; the scope itself is deliberately unfiltered. */
export function allBuildsScope(): ListScope {
  return { baseFilter: Prisma.sql`TRUE` }
}

/** The org list scope for a viewer: members see everything published under
 *  the org, everyone else only PUBLIC. */
export async function orgListScope(
  organizationId: string,
  viewerId: string | undefined,
): Promise<ListScope> {
  const member =
    viewerId != null && (await isOrgMember(organizationId, viewerId))
  return member
    ? orgMemberScope(organizationId)
    : orgPublicScope(organizationId)
}
