import { Prisma } from "../generated/prisma/client"
import { BuildVisibility } from "../generated/prisma/enums"

/**
 * Single source of truth for the Visibility scope of every Build *list* query.
 *
 * runList (_build-list.ts) scopes a query two ways at once: a Prisma `where`
 * for the paged findMany and a raw-SQL `baseFilter` for the full-text-search /
 * count path. The two halves must express the same predicate, or a list leaks
 * Builds the viewer shouldn't see. Defining both together — one function per
 * scope — makes them impossible to edit in isolation, so they can't silently
 * drift. (Per-Build view/mutate checks for single builds stay in builds.ts;
 * this module is only the list scopes.)
 *
 * The fields are named to match runList's params so a route spreads a scope:
 *   runList({ filters, ...publicScope(), defaultSort: "newest" })
 */
export interface ListScope {
  baseWhere: Prisma.BuildWhereInput
  baseFilter: Prisma.Sql
}

/** PUBLIC Builds only — the global browse list (`GET /builds`). */
export function publicScope(): ListScope {
  return {
    baseWhere: { visibility: BuildVisibility.PUBLIC },
    baseFilter: Prisma.sql`visibility = 'PUBLIC'`,
  }
}

/** Every Build owned by `userId`, at any Visibility — the owner's own list
 *  (`GET /builds/mine`). */
export function ownerScope(userId: string): ListScope {
  return {
    baseWhere: { userId },
    baseFilter: Prisma.sql`"userId" = ${userId}`,
  }
}

/** Builds `userId` has bookmarked AND may still see: PUBLIC, UNLISTED, or their
 *  own — never someone else's PRIVATE (`GET /builds/bookmarks`). */
export function bookmarkedScope(userId: string): ListScope {
  return {
    baseWhere: {
      bookmarks: { some: { userId } },
      OR: [
        { visibility: BuildVisibility.PUBLIC },
        { visibility: BuildVisibility.UNLISTED },
        { userId },
      ],
    },
    baseFilter: Prisma.sql`
      EXISTS (
        SELECT 1 FROM build_bookmarks bb
        WHERE bb."buildId" = builds.id AND bb."userId" = ${userId}
      )
      AND (visibility IN ('PUBLIC', 'UNLISTED') OR "userId" = ${userId})
    `,
  }
}

/** The Build-side half of `userPublicScope`, with no `userId` bound — the
 *  predicate for "a Build that counts as its author's public work".
 *
 *  Exported so the profile directory (`GET /users`) can ask *whether* a User
 *  has any such Build and *how many* using the same test the profile page
 *  itself lists and counts by. Filtering the directory on a looser predicate
 *  would list authors whose profile then renders empty. Compose it, don't
 *  restate it. See `userPublicScope` for why the OR is shaped this way. */
export const AUTHORED_PUBLIC_BUILD = {
  visibility: BuildVisibility.PUBLIC,
  OR: [{ organizationId: null }, { hideAuthor: false }],
} as const satisfies Prisma.BuildWhereInput

/** A User's authored PUBLIC Builds — their public profile list and aggregate
 *  stats (`GET /users/:username[/builds]`). Org-published Builds count as the
 *  author's work and appear here too (#317; cards carry the org byline, so
 *  attribution stays unambiguous) — except when the Build sets `hideAuthor`,
 *  which exists to keep the author off an org Build. Listing those on the
 *  author's own profile would undo the flag.
 *
 *  The `organizationId IS NULL` half of the OR is not redundant with
 *  `hideAuthor = false`: deleting an Organization nulls `organizationId`
 *  through the schema's `onDelete: SetNull` without any app code running, so a
 *  detached Build can carry a stale `hideAuthor = true` pointing at an org
 *  that no longer exists. A Build with no org has no org to hide behind — it
 *  belongs on its author's profile regardless of the flag. */
export function userPublicScope(userId: string): ListScope {
  return {
    baseWhere: { userId, ...AUTHORED_PUBLIC_BUILD },
    baseFilter: Prisma.sql`"userId" = ${userId} AND visibility = 'PUBLIC' AND ("organizationId" IS NULL OR "hideAuthor" = false)`,
  }
}

/** An Organization's PUBLIC Builds — its public profile list
 *  (`GET /orgs/:slug/builds`). */
export function orgPublicScope(organizationId: string): ListScope {
  return {
    baseWhere: {
      organizationId,
      visibility: BuildVisibility.PUBLIC,
    },
    baseFilter: Prisma.sql`"organizationId" = ${organizationId} AND visibility = 'PUBLIC'`,
  }
}

/** Every Build published under an Organization, at any Visibility — the org
 *  page as seen by the org's own members (`GET /orgs/:slug/builds` when the
 *  viewer is a member). Mirrors the per-Build rule in builds.ts, where org
 *  membership grants view access to the org's PRIVATE Builds (#274). */
export function orgMemberScope(organizationId: string): ListScope {
  return {
    baseWhere: { organizationId },
    baseFilter: Prisma.sql`"organizationId" = ${organizationId}`,
  }
}

/** No Visibility filter at all — the admin moderation list sees every Build
 *  regardless of Visibility (`GET /admin/builds`). Guarded by requireAdmin at
 *  the route; the scope itself is deliberately unfiltered. */
export function allBuildsScope(): ListScope {
  return {
    baseWhere: {},
    baseFilter: Prisma.sql`TRUE`,
  }
}
