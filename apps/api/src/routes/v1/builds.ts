import { Hono } from "hono"

import { prisma } from "../../db"
import { Prisma } from "../../generated/prisma/client"
import { BuildVisibility } from "../../generated/prisma/enums"
import { requireApiKey } from "../../lib/api-key-auth"
import { SCOPE_BUILD_READ } from "../../lib/api-keys"
import { parseListQuery, runList } from "../_build-list"

export const v1Builds = new Hono()

v1Builds.get("/", requireApiKey(SCOPE_BUILD_READ), async (c) => {
  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: { visibility: BuildVisibility.PUBLIC },
    baseFilter: Prisma.sql`visibility = 'PUBLIC'`,
    defaultSort: "newest",
  })
  return c.json(result)
})

v1Builds.get("/:slug", requireApiKey(SCOPE_BUILD_READ), async (c) => {
  const build = await prisma.build.findUnique({
    where: { slug: c.req.param("slug") },
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
  })

  if (!build || build.visibility !== BuildVisibility.PUBLIC) {
    return c.json({ error: "not_found" }, 404)
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
    likeCount: build.likeCount,
    bookmarkCount: build.bookmarkCount,
    viewCount: build.viewCount,
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
    user: build.user,
    organization: build.organization,
    guide: build.buildGuide,
  })
})
