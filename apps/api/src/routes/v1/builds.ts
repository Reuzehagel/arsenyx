import { Hono } from "hono"

import { prisma } from "../../db"
import { Prisma } from "../../generated/prisma/client"
import { BuildVisibility } from "../../generated/prisma/enums"
import { requireApiKey } from "../../lib/api-key-auth"
import { SCOPE_BUILD_READ } from "../../lib/api-keys"
import {
  DETAIL_INCLUDE,
  parseListQuery,
  runList,
  serializeBuildDetail,
} from "../_build-list"

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
    include: DETAIL_INCLUDE,
  })

  if (!build || build.visibility !== BuildVisibility.PUBLIC) {
    return c.json({ error: "not_found" }, 404)
  }

  return c.json(serializeBuildDetail(build, null))
})
