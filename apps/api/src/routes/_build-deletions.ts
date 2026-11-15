import type { OrgDeletedBuild } from "@arsenyx/shared/api/orgs"
import type { PublicUser } from "@arsenyx/shared/api/users"
import type { Context } from "hono"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import type { BuildVisibility } from "../generated/prisma/enums"
import { DELETION_RETENTION_DAYS, invalidateBuilds } from "./_build-snapshot"

// Reading and undoing BuildDeletion tombstones (written by deleteBuild in
// _build-snapshot.ts). An org's admins see the org's recently deleted builds
// and can bring one back; nothing here deletes a tombstone, so the record of
// who deleted what outlives a restore.

/** The tombstone's `build` JSON: the builds row as Prisma returned it
 *  (dates as ISO strings), plus the relations deleteBuild includes. Votes and
 *  bookmarks are absent on tombstones written before they were saved. */
type TombstoneBuild = {
  id: string
  slug: string
  userId: string
  organizationId: string | null
  hideAuthor: boolean
  itemUniqueName: string
  itemCategory: string
  itemName: string
  itemImageName: string | null
  name: string
  description: string | null
  visibility: BuildVisibility
  buildData: Prisma.InputJsonValue
  hasShards: boolean
  hasGuide: boolean
  formaCount: number
  formaCalcVersion: number
  catalogVersion: string | null
  viewCount: number
  forkedFromId: string | null
  partnerOrder?: string[]
  partnerVariants?: Prisma.InputJsonValue
  createdAt: string
  updatedAt: string
  buildGuide: {
    id: string
    summary: string | null
    description: string | null
    createdAt: string
    updatedAt: string
  } | null
  partnerBuilds?: { id: string }[]
  likes?: { userId: string; value: number; createdAt: string }[]
  bookmarks?: { userId: string; createdAt: string }[]
}

const LIST_LIMIT = 200

const retentionCutoff = () =>
  new Date(Date.now() - DELETION_RETENTION_DAYS * 86_400_000)

type DeletedRow = {
  id: string
  slug: string
  deletedAt: Date
  name: string
  itemUniqueName: string
  itemCategory: string
  itemName: string
  itemImageName: string | null
  likeCount: number
  author: PublicUser | null
  deletedBy: PublicUser | null
}

const userJson = (alias: string) =>
  Prisma.raw(`CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object(
    'id', ${alias}.id, 'name', ${alias}.name, 'username', ${alias}.username,
    'displayUsername', ${alias}."displayUsername", 'image', ${alias}.image
  ) END`)

/** Builds deleted from `organizationId` within the restore window whose slug
 *  isn't live again (restored, by this or by hand), newest first. A build
 *  deleted, restored and deleted again shows once, as its latest deletion. */
export async function listOrgDeletions(
  organizationId: string,
): Promise<OrgDeletedBuild[]> {
  const rows = await prisma.$queryRaw<DeletedRow[]>`
    SELECT * FROM (
      SELECT DISTINCT ON (d.slug)
        d.id, d.slug, d."deletedAt",
        d.build->>'name' AS name,
        d.build->>'itemUniqueName' AS "itemUniqueName",
        d.build->>'itemCategory' AS "itemCategory",
        d.build->>'itemName' AS "itemName",
        d.build->>'itemImageName' AS "itemImageName",
        (SELECT COUNT(*)::int FROM jsonb_array_elements(
          COALESCE(d.build->'likes', '[]'::jsonb)) l
         WHERE (l->>'value')::int = 1) AS "likeCount",
        ${userJson("au")} AS author,
        ${userJson("du")} AS "deletedBy"
      FROM build_deletions d
      LEFT JOIN users au ON au.id = d.build->>'userId'
      LEFT JOIN users du ON du.id = d."deletedById"
      WHERE d.build->>'organizationId' = ${organizationId}
        AND d."deletedAt" >= ${retentionCutoff()}
        AND NOT EXISTS (SELECT 1 FROM builds b WHERE b.slug = d.slug)
      ORDER BY d.slug, d."deletedAt" DESC
    ) latest
    ORDER BY "deletedAt" DESC
    LIMIT ${LIST_LIMIT}
  `
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    item: {
      uniqueName: r.itemUniqueName,
      category: r.itemCategory,
      name: r.itemName,
      imageName: r.itemImageName,
    },
    author: r.author,
    deletedBy: r.deletedBy,
    deletedAt: r.deletedAt.toISOString(),
    likeCount: r.likeCount,
  }))
}

export type RestoreResult =
  | { ok: true; slug: string }
  | { ok: false; error: "not_found" | "already_restored" }

/** Recreates the build a tombstone of `organizationId` recorded: same id and
 *  slug (old links work again), its guide, votes and bookmarks from accounts
 *  that still exist, and its partner links to builds that still exist, both
 *  sides. Counters are recounted from what came back. An author whose
 *  account is gone hands it to `actorId` with the author hidden, as account
 *  deletion would have (beforeUserDeletion). Revisions and view history were
 *  never kept. */
export async function restoreOrgDeletion(
  c: Context,
  organizationId: string,
  deletionId: string,
  actorId: string,
): Promise<RestoreResult> {
  const result = await prisma.$transaction(async (tx) => {
    // Two admins restoring the same build queue here; the second finds it live.
    const [row] = await tx.$queryRaw<{ build: TombstoneBuild }[]>`
      SELECT build FROM build_deletions
      WHERE id = ${deletionId}
        AND build->>'organizationId' = ${organizationId}
        AND "deletedAt" >= ${retentionCutoff()}
      FOR UPDATE
    `
    if (!row) return { ok: false, error: "not_found" } as const
    const b = row.build

    const live = await tx.build.count({
      where: { OR: [{ id: b.id }, { slug: b.slug }] },
    })
    if (live > 0) return { ok: false, error: "already_restored" } as const

    const likes = b.likes ?? []
    const bookmarks = b.bookmarks ?? []
    const partnerIds = (b.partnerBuilds ?? []).map((p) => p.id)
    const [users, partners, forkedFrom] = await Promise.all([
      tx.user.findMany({
        where: {
          id: {
            in: [
              b.userId,
              ...likes.map((l) => l.userId),
              ...bookmarks.map((m) => m.userId),
            ],
          },
        },
        select: { id: true },
      }),
      tx.build.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, slug: true },
      }),
      b.forkedFromId
        ? tx.build.count({ where: { id: b.forkedFromId } })
        : Promise.resolve(0),
    ])
    const exists = new Set(users.map((u) => u.id))
    const keptLikes = likes.filter((l) => exists.has(l.userId))
    const keptBookmarks = bookmarks.filter((m) => exists.has(m.userId))
    const authorGone = !exists.has(b.userId)

    await tx.build.create({
      data: {
        id: b.id,
        slug: b.slug,
        userId: authorGone ? actorId : b.userId,
        organizationId,
        hideAuthor: authorGone ? true : b.hideAuthor,
        itemUniqueName: b.itemUniqueName,
        itemCategory: b.itemCategory,
        itemName: b.itemName,
        itemImageName: b.itemImageName,
        name: b.name,
        description: b.description,
        visibility: b.visibility,
        buildData: b.buildData,
        hasShards: b.hasShards,
        hasGuide: b.hasGuide,
        formaCount: b.formaCount ?? 0,
        formaCalcVersion: b.formaCalcVersion ?? 0,
        catalogVersion: b.catalogVersion ?? null,
        viewCount: b.viewCount,
        likeCount: keptLikes.filter((l) => l.value === 1).length,
        dislikeCount: keptLikes.filter((l) => l.value === -1).length,
        bookmarkCount: keptBookmarks.length,
        forkedFromId: forkedFrom > 0 ? b.forkedFromId : null,
        partnerOrder: b.partnerOrder ?? [],
        partnerVariants: b.partnerVariants ?? {},
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        ...(b.buildGuide && {
          buildGuide: {
            create: {
              id: b.buildGuide.id,
              summary: b.buildGuide.summary,
              description: b.buildGuide.description,
              createdAt: b.buildGuide.createdAt,
              updatedAt: b.buildGuide.updatedAt,
            },
          },
        }),
        likes: {
          create: keptLikes.map((l) => ({
            userId: l.userId,
            value: l.value,
            createdAt: l.createdAt,
          })),
        },
        bookmarks: {
          create: keptBookmarks.map((m) => ({
            userId: m.userId,
            createdAt: m.createdAt,
          })),
        },
        // Prisma's implicit self-M:N writes one side of the join row; the
        // partners' own side is mirrored below (as the partner routes do).
        partnerBuilds: { connect: partners.map((p) => ({ id: p.id })) },
      },
    })
    for (const p of partners) {
      await tx.build.update({
        where: { id: p.id },
        data: { partnerBuilds: { connect: { id: b.id } } },
      })
    }
    return {
      ok: true,
      slug: b.slug,
      partnerSlugs: partners.map((p) => p.slug),
    } as const
  })
  if (!result.ok) return result
  invalidateBuilds(c, [result.slug, ...result.partnerSlugs])
  return { ok: true, slug: result.slug }
}
