import { Hono } from "hono";
import { customAlphabet } from "nanoid";

import { isValidCategory } from "@arsenyx/shared/warframe/categories";
import { Prisma } from "../generated/prisma/client";
import { BuildVisibility } from "../generated/prisma/enums";
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace";

import { auth } from "../auth";
import { prisma } from "../db";
import { parseListQuery, runList } from "./_build-list";

export const builds = new Hono();

// URL-safe alphabet without visually-confusing chars (no 0/O, 1/l/I).
const generateSlug = customAlphabet(
  "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
  10,
);

const MAX_NAME = 120;
const MAX_DESCRIPTION = 2000;
const MAX_GUIDE_SUMMARY = 400;
const MAX_GUIDE_DESCRIPTION = 50_000;

function isVisibility(v: unknown): v is BuildVisibility {
  return (
    typeof v === "string" &&
    Object.values(BuildVisibility).includes(v as BuildVisibility)
  );
}

function trimToMax(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

function hasShardsInBuildData(buildData: unknown): boolean {
  if (!buildData || typeof buildData !== "object") return false;
  const shards = (buildData as Record<string, unknown>).shards;
  return Array.isArray(shards) && shards.some((s) => s != null);
}

function parseGuide(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const g = input as Record<string, unknown>;
  const summary = trimToMax(g.summary, MAX_GUIDE_SUMMARY);
  const description = trimToMax(g.description, MAX_GUIDE_DESCRIPTION);
  return { summary, description, hasGuide: summary != null || description != null };
}

builds.post("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid_body" }, 400);
  }
  const b = body as Record<string, unknown>;

  const itemUniqueName = typeof b.itemUniqueName === "string" ? b.itemUniqueName.trim() : "";
  const itemCategory = typeof b.itemCategory === "string" ? b.itemCategory : "";
  const itemName = typeof b.itemName === "string" ? b.itemName.trim() : "";
  const itemImageName = typeof b.itemImageName === "string" ? b.itemImageName : null;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const description = trimToMax(b.description, MAX_DESCRIPTION);
  const visibility: BuildVisibility = isVisibility(b.visibility) ? b.visibility : "PUBLIC";

  if (!itemUniqueName) return c.json({ error: "missing_item_unique_name" }, 400);
  if (!isValidCategory(itemCategory)) return c.json({ error: "invalid_category" }, 400);
  if (!itemName) return c.json({ error: "missing_item_name" }, 400);
  if (!name || name.length > MAX_NAME) return c.json({ error: "invalid_name" }, 400);
  if (!b.buildData || typeof b.buildData !== "object") {
    return c.json({ error: "invalid_build_data" }, 400);
  }

  const buildData = b.buildData as InputJsonValue;
  const guide = parseGuide(b.guide);

  // Retry on the astronomically-unlikely slug collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      const created = await prisma.build.create({
        data: {
          slug,
          userId: session.user.id,
          itemUniqueName,
          itemCategory,
          itemName,
          itemImageName,
          name,
          description,
          visibility,
          buildData,
          hasShards: hasShardsInBuildData(buildData),
          hasGuide: guide?.hasGuide ?? false,
          buildGuide: guide?.hasGuide
            ? { create: { summary: guide.summary, description: guide.description } }
            : undefined,
        },
        select: { id: true, slug: true },
      });
      return c.json(created, 201);
    } catch (err: unknown) {
      // P2002 = unique constraint on slug → retry
      if (
        typeof err === "object" &&
        err != null &&
        (err as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }

  return c.json({ error: "slug_collision" }, 500);
});

builds.patch("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);

  const existing = await prisma.build.findUnique({
    where: { slug },
    select: { id: true, userId: true },
  });
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.userId !== session.user.id) {
    return c.json({ error: "forbidden" }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid_body" }, 400);
  }
  const b = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof b.name === "string") {
    const name = b.name.trim();
    if (!name || name.length > MAX_NAME) return c.json({ error: "invalid_name" }, 400);
    data.name = name;
  }
  if (typeof b.description === "string" || b.description === null) {
    data.description = trimToMax(b.description, MAX_DESCRIPTION);
  }
  if (isVisibility(b.visibility)) {
    data.visibility = b.visibility;
  }
  if (b.buildData && typeof b.buildData === "object") {
    data.buildData = b.buildData as InputJsonValue;
    data.hasShards = hasShardsInBuildData(b.buildData);
  }

  const guide = parseGuide(b.guide);
  if (guide) {
    data.hasGuide = guide.hasGuide;
    data.buildGuide = {
      upsert: {
        create: { summary: guide.summary, description: guide.description },
        update: { summary: guide.summary, description: guide.description },
      },
    };
  }

  const updated = await prisma.build.update({
    where: { id: existing.id },
    data,
    select: { id: true, slug: true },
  });
  return c.json(updated);
});

builds.get("/", async (c) => {
  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: { visibility: BuildVisibility.PUBLIC },
    baseFilter: Prisma.sql`visibility = 'PUBLIC'`,
    defaultSort: "newest",
  });
  return c.json(result);
});

builds.get("/mine", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);

  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: { userId: session.user.id },
    baseFilter: Prisma.sql`"userId" = ${session.user.id}`,
    defaultSort: "updated",
  });
  return c.json(result);
});

builds.get("/favorites", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  const userId = session.user.id;

  // Favorited AND visible to viewer (own / public / unlisted; not others' private).
  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: {
      favorites: { some: { userId } },
      OR: [
        { visibility: BuildVisibility.PUBLIC },
        { visibility: BuildVisibility.UNLISTED },
        { userId },
      ],
    },
    baseFilter: Prisma.sql`
      EXISTS (
        SELECT 1 FROM build_favorites bf
        WHERE bf."buildId" = builds.id AND bf."userId" = ${userId}
      )
      AND (visibility IN ('PUBLIC', 'UNLISTED') OR "userId" = ${userId})
    `,
    defaultSort: "newest",
  });
  return c.json(result);
});

async function getBuildForSocial(slug: string) {
  return prisma.build.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      voteCount: true,
      favoriteCount: true,
    },
  });
}

async function canViewerSeeBuild(
  build: { userId: string; visibility: BuildVisibility; organizationId: string | null },
  viewerId: string,
) {
  if (build.visibility === "PUBLIC" || build.visibility === "UNLISTED") return true;
  if (build.userId === viewerId) return true;
  if (build.organizationId) {
    return isOrgMember(build.organizationId, viewerId);
  }
  return false;
}

builds.post("/:slug/vote", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  const userId = session.user.id;

  const build = await getBuildForSocial(c.req.param("slug"));
  if (!build) return c.json({ error: "not_found" }, 404);
  if (!(await canViewerSeeBuild(build, userId))) {
    return c.json({ error: "not_found" }, 404);
  }
  if (build.userId === userId) {
    return c.json({ error: "cannot_vote_own_build" }, 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildVote.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    });
    if (existing) {
      return { hasVoted: true, voteCount: build.voteCount };
    }
    await tx.buildVote.create({
      data: { userId, buildId: build.id, value: 1 },
    });
    const row = await tx.build.update({
      where: { id: build.id },
      data: { voteCount: { increment: 1 } },
      select: { voteCount: true },
    });
    return { hasVoted: true, voteCount: row.voteCount };
  });
  return c.json(updated);
});

builds.delete("/:slug/vote", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  const userId = session.user.id;

  const build = await getBuildForSocial(c.req.param("slug"));
  if (!build) return c.json({ error: "not_found" }, 404);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildVote.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    });
    if (!existing) {
      return { hasVoted: false, voteCount: build.voteCount };
    }
    await tx.buildVote.delete({ where: { id: existing.id } });
    const row = await tx.build.update({
      where: { id: build.id },
      data: { voteCount: { decrement: 1 } },
      select: { voteCount: true },
    });
    return { hasVoted: false, voteCount: row.voteCount };
  });
  return c.json(updated);
});

builds.post("/:slug/favorite", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  const userId = session.user.id;

  const build = await getBuildForSocial(c.req.param("slug"));
  if (!build) return c.json({ error: "not_found" }, 404);
  if (!(await canViewerSeeBuild(build, userId))) {
    return c.json({ error: "not_found" }, 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildFavorite.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    });
    if (existing) {
      return { hasFavorited: true, favoriteCount: build.favoriteCount };
    }
    await tx.buildFavorite.create({ data: { userId, buildId: build.id } });
    const row = await tx.build.update({
      where: { id: build.id },
      data: { favoriteCount: { increment: 1 } },
      select: { favoriteCount: true },
    });
    return { hasFavorited: true, favoriteCount: row.favoriteCount };
  });
  return c.json(updated);
});

builds.delete("/:slug/favorite", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  const userId = session.user.id;

  const build = await getBuildForSocial(c.req.param("slug"));
  if (!build) return c.json({ error: "not_found" }, 404);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildFavorite.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    });
    if (!existing) {
      return { hasFavorited: false, favoriteCount: build.favoriteCount };
    }
    await tx.buildFavorite.delete({ where: { id: existing.id } });
    const row = await tx.build.update({
      where: { id: build.id },
      data: { favoriteCount: { decrement: 1 } },
      select: { favoriteCount: true },
    });
    return { hasFavorited: false, favoriteCount: row.favoriteCount };
  });
  return c.json(updated);
});

builds.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const [session, build] = await Promise.all([
    auth.api.getSession({ headers: c.req.raw.headers }),
    prisma.build.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        organization: {
          select: { id: true, name: true, slug: true, image: true },
        },
        buildGuide: {
          select: { summary: true, description: true, updatedAt: true },
        },
      },
    }),
  ]);

  if (!build) return c.json({ error: "not_found" }, 404);

  const viewerId = session?.user.id;
  const canView =
    build.visibility === "PUBLIC" ||
    build.visibility === "UNLISTED" ||
    (viewerId != null && build.userId === viewerId) ||
    (viewerId != null &&
      build.organizationId != null &&
      (await isOrgMember(build.organizationId, viewerId)));

  if (!canView) return c.json({ error: "not_found" }, 404);

  await maybeIncrementView(c, build.id, build.slug, viewerId, build.userId);

  let viewerHasVoted = false;
  let viewerHasFavorited = false;
  if (viewerId) {
    const [vote, fav] = await Promise.all([
      prisma.buildVote.findUnique({
        where: { userId_buildId: { userId: viewerId, buildId: build.id } },
        select: { id: true },
      }),
      prisma.buildFavorite.findUnique({
        where: { userId_buildId: { userId: viewerId, buildId: build.id } },
        select: { id: true },
      }),
    ]);
    viewerHasVoted = vote != null;
    viewerHasFavorited = fav != null;
  }

  return c.json({
    id: build.id,
    slug: build.slug,
    name: build.name,
    description: build.description,
    visibility: build.visibility,
    item: {
      uniqueName: build.itemUniqueName,
      category: build.itemCategory,
      name: build.itemName,
      imageName: build.itemImageName,
    },
    buildData: build.buildData,
    hasShards: build.hasShards,
    hasGuide: build.hasGuide,
    voteCount: build.voteCount,
    favoriteCount: build.favoriteCount,
    viewCount: build.viewCount,
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
    user: build.user,
    organization: build.organization,
    guide: build.buildGuide,
    isOwner: viewerId != null && build.userId === viewerId,
    viewerHasVoted,
    viewerHasFavorited,
  });
});

const VIEW_COOKIE_MAX_AGE = 12 * 60 * 60; // 12h

async function maybeIncrementView(
  c: { req: { raw: Request }; header: (k: string, v: string) => void },
  buildId: string,
  slug: string,
  viewerId: string | undefined,
  ownerId: string,
) {
  if (viewerId && viewerId === ownerId) return;
  const cookieName = `vw_${slug}`;
  const cookieHeader = c.req.raw.headers.get("cookie") ?? "";
  const has = cookieHeader.split(/;\s*/).some((p) => p.startsWith(`${cookieName}=`));
  if (has) return;
  await prisma.build.update({
    where: { id: buildId },
    data: { viewCount: { increment: 1 } },
    select: { id: true },
  });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  c.header(
    "Set-Cookie",
    `${cookieName}=1; Path=/; Max-Age=${VIEW_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`,
  );
}

async function isOrgMember(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  });
  return membership != null;
}
