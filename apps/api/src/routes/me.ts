import { Hono, type Context } from "hono"

import { prisma } from "../db"
import { getSession } from "../lib/session"

export const me = new Hono()

async function requireSession(c: Context) {
  const session = await getSession(c)
  if (!session?.user) return null
  return session.user
}

me.get("/builds/export", async (c) => {
  const user = await requireSession(c)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const builds = await prisma.build.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      itemUniqueName: true,
      itemCategory: true,
      itemName: true,
      itemImageName: true,
      name: true,
      description: true,
      visibility: true,
      buildData: true,
      hasShards: true,
      hasGuide: true,
      createdAt: true,
      updatedAt: true,
      forkedFromId: true,
      organizationId: true,
    },
  })

  const date = new Date().toISOString().slice(0, 10)
  const payload = {
    exportedAt: new Date().toISOString(),
    userId: user.id,
    count: builds.length,
    builds,
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="arsenyx-builds-${date}.json"`,
    },
  })
})
