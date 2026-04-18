import { Hono } from "hono";
import { customAlphabet } from "nanoid";

import { isValidCategory } from "@arsenyx/shared/warframe/categories";
import { BuildVisibility } from "../generated/prisma/enums";
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace";

import { auth } from "../auth";
import { prisma } from "../db";

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
  });
});

async function isOrgMember(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  });
  return membership != null;
}
