import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"
import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import {
  FORMA_CALC_VERSION,
  FORMA_UNSTAMPED,
  MAX_FORMA_COUNT,
} from "@arsenyx/shared/warframe/forma"
import { Hono, type Context } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { customAlphabet } from "nanoid"

import { prisma, registerBackgroundWork } from "../db"
import { Prisma } from "../generated/prisma/client"
import { BuildVisibility } from "../generated/prisma/enums"
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace"
import { edgeCache, purgeEdge } from "../lib/edge-cache"
import { getSession } from "../lib/session"
import { hasPrismaCode, parseJsonBody, trimToMax } from "../lib/validate"
import { enforceAnonEdgeLimit, rateLimitUser } from "../middleware/rate-limit"
import {
  DETAIL_INCLUDE,
  LIST_SELECT,
  parseListQuery,
  runList,
  serializeBuildDetail,
  serializeListRow,
} from "./_build-list"
import { toggleSocial } from "./_build-social"
import { bookmarkedScope, ownerScope, publicScope } from "./_build-visibility"

export const builds = new Hono()

// URL-safe alphabet without visually-confusing chars (no 0/O, 1/l/I).
const generateSlug = customAlphabet(
  "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
  10,
)

// Attempts a fresh slug on @@unique collision. With a 56-char alphabet and
// 10-char slugs the collision space is ~3e17; 5 retries is dramatically more
// than enough.
const SLUG_COLLISION_RETRIES = 5

const MAX_NAME = 120
const MAX_DESCRIPTION = 2000
const MAX_GUIDE_SUMMARY = 400
const MAX_GUIDE_DESCRIPTION = 50_000

// Exported so the admin visibility PATCH (admin.ts) validates against the same
// guard rather than keeping a divergent copy — visibility logic stays centralised
// here per apps/api/CLAUDE.md.
export function isVisibility(v: unknown): v is BuildVisibility {
  return (
    typeof v === "string" &&
    Object.values(BuildVisibility).includes(v as BuildVisibility)
  )
}

// Defense in depth: the editor caps `variants` at MAX_VARIANTS *per form*
// (twin-frames like Sirius & Orion give each form its own budget), but a
// crafted request could send more. Persisting an unbounded array would
// bloat the Build.buildData JSON column. Group by `formIndex` and reject if
// any single form exceeds the cap, or there are implausibly many forms.
const MAX_FORMS = 4
export function variantsOverCap(buildData: unknown): boolean {
  if (!buildData || typeof buildData !== "object") return false
  const variants = (buildData as Record<string, unknown>).variants
  if (!Array.isArray(variants)) return false
  const perForm = new Map<number, number>()
  for (const v of variants) {
    const fi =
      v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>).formIndex === "number"
        ? ((v as Record<string, unknown>).formIndex as number)
        : 0
    perForm.set(fi, (perForm.get(fi) ?? 0) + 1)
  }
  if (perForm.size > MAX_FORMS) return true
  for (const count of perForm.values()) if (count > MAX_VARIANTS) return true
  return false
}

function hasShardsInBuildData(buildData: unknown): boolean {
  if (!buildData || typeof buildData !== "object") return false
  const data = buildData as Record<string, unknown>
  const anyPlaced = (v: unknown): boolean =>
    Array.isArray(v) && v.some((s) => s != null)
  // Top-level `shards` mirrors the active variant (and is the only set for
  // single-loadout builds).
  if (anyPlaced(data.shards)) return true
  // Shards are per-variant — any variant carrying its own set counts.
  if (Array.isArray(data.variants)) {
    if (
      data.variants.some(
        (v) =>
          v &&
          typeof v === "object" &&
          anyPlaced((v as Record<string, unknown>).shards),
      )
    )
      return true
  }
  // Legacy twin-frame per-form shards (pre per-variant builds).
  const formShards = data.formShards
  if (formShards && typeof formShards === "object") {
    return Object.values(formShards as Record<string, unknown>).some(anyPlaced)
  }
  return false
}

const MAX_CATALOG_VERSION = 64

// Forma count is computed client-side (the only place with the game catalog of
// innate polarities) and sent on save. We trust but bound it: a non-negative
// integer ≤ MAX_FORMA_COUNT. Returns null when absent/invalid so callers can
// decide whether that's a hard error (POST) or a no-op (PATCH without buildData).
// The version stamp is set server-side from FORMA_CALC_VERSION — never trusted
// from the client — so a stale client can't claim its count is current.
function parseFormaFields(b: Record<string, unknown>): {
  formaCount: number
  formaCalcVersion: number
  catalogVersion: string | null
} | null {
  const raw = b.formaCount
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null
  if (raw < 0 || raw > MAX_FORMA_COUNT) return null
  const catalogVersion =
    typeof b.catalogVersion === "string"
      ? b.catalogVersion.slice(0, MAX_CATALOG_VERSION)
      : null
  return {
    formaCount: raw,
    formaCalcVersion: FORMA_CALC_VERSION,
    catalogVersion,
  }
}

function parseGuide(input: unknown) {
  if (!input || typeof input !== "object") return null
  const g = input as Record<string, unknown>
  const summary = trimToMax(g.summary, MAX_GUIDE_SUMMARY)
  const description = trimToMax(g.description, MAX_GUIDE_DESCRIPTION)
  return {
    summary,
    description,
    hasGuide: summary != null || description != null,
  }
}

builds.post("/", rateLimitUser("mutate"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const parsed = await parseJsonBody(c)
  if (!parsed.ok) return parsed.response
  const b = parsed.value

  const itemUniqueName =
    typeof b.itemUniqueName === "string" ? b.itemUniqueName.trim() : ""
  const itemCategory = typeof b.itemCategory === "string" ? b.itemCategory : ""
  const itemName = typeof b.itemName === "string" ? b.itemName.trim() : ""
  const itemImageName =
    typeof b.itemImageName === "string" ? b.itemImageName : null
  const name = typeof b.name === "string" ? b.name.trim() : ""
  const description = trimToMax(b.description, MAX_DESCRIPTION)
  const userDefault = (session.user as { defaultBuildVisibility?: string })
    .defaultBuildVisibility
  const visibility: BuildVisibility = isVisibility(b.visibility)
    ? b.visibility
    : isVisibility(userDefault)
      ? userDefault
      : "PUBLIC"

  if (!itemUniqueName) return c.json({ error: "missing_item_unique_name" }, 400)
  if (!isValidCategory(itemCategory))
    return c.json({ error: "invalid_category" }, 400)
  if (!itemName) return c.json({ error: "missing_item_name" }, 400)
  if (!name || name.length > MAX_NAME)
    return c.json({ error: "invalid_name" }, 400)
  if (!b.buildData || typeof b.buildData !== "object") {
    return c.json({ error: "invalid_build_data" }, 400)
  }
  if (variantsOverCap(b.buildData)) {
    return c.json({ error: "too_many_variants" }, 400)
  }

  const buildData = b.buildData as InputJsonValue
  const guide = parseGuide(b.guide)
  // Lenient: a client that doesn't send a count (or sends a bad one) gets a
  // sentinel `formaCalcVersion: 0` row, which the recompute backfill picks up.
  const forma = parseFormaFields(b) ?? {
    formaCount: 0,
    formaCalcVersion: FORMA_UNSTAMPED,
    catalogVersion: null,
  }

  const orgResult = await resolveOrgAssignment(
    b.organizationId,
    session.user.id,
  )
  if (!orgResult.ok) return c.json({ error: orgResult.error }, orgResult.status)
  const organizationId = orgResult.value
  // Author can opt to suppress their handle on org-published builds.
  // Always false when there's no org (no-op).
  const hideAuthor = organizationId !== null && b.hideAuthor === true

  // Retry on the astronomically-unlikely slug collision.
  for (let attempt = 0; attempt < SLUG_COLLISION_RETRIES; attempt++) {
    const slug = generateSlug()
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
          organizationId,
          hideAuthor,
          buildData,
          hasShards: hasShardsInBuildData(buildData),
          formaCount: forma.formaCount,
          formaCalcVersion: forma.formaCalcVersion,
          catalogVersion: forma.catalogVersion,
          hasGuide: guide?.hasGuide ?? false,
          buildGuide: guide?.hasGuide
            ? {
                create: {
                  summary: guide.summary,
                  description: guide.description,
                },
              }
            : undefined,
        },
        select: { id: true, slug: true },
      })
      return c.json(created, 201)
    } catch (err: unknown) {
      // P2002 = unique constraint on slug → retry
      if (hasPrismaCode(err, "P2002")) continue
      throw err
    }
  }

  return c.json({ error: "slug_collision" }, 500)
})

builds.patch("/:slug", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug")

  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const existing = await prisma.build.findUnique({
    where: { slug },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!existing) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(existing, session.user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  const parsed = await parseJsonBody(c)
  if (!parsed.ok) return parsed.response
  const b = parsed.value

  const data: Record<string, unknown> = {}
  if (typeof b.name === "string") {
    const name = b.name.trim()
    if (!name || name.length > MAX_NAME)
      return c.json({ error: "invalid_name" }, 400)
    data.name = name
  }
  if (typeof b.description === "string" || b.description === null) {
    data.description = trimToMax(b.description, MAX_DESCRIPTION)
  }
  if (isVisibility(b.visibility)) {
    data.visibility = b.visibility
  }
  if (b.organizationId === null || typeof b.organizationId === "string") {
    const orgResult = await resolveOrgAssignment(
      b.organizationId,
      session.user.id,
    )
    if (!orgResult.ok)
      return c.json({ error: orgResult.error }, orgResult.status)
    data.organizationId = orgResult.value
  }
  // hideAuthor only makes sense when the build is org-published. We use the
  // effective org after this PATCH (incoming value if provided, else the
  // existing one) so toggling org off forces hideAuthor back to false in the
  // same write — no stale flag pointing at a now-null org.
  if (typeof b.hideAuthor === "boolean") {
    const effectiveOrgId =
      data.organizationId !== undefined
        ? data.organizationId
        : existing.organizationId
    data.hideAuthor = effectiveOrgId !== null && b.hideAuthor === true
  } else if (
    data.organizationId !== undefined &&
    data.organizationId !== existing.organizationId
  ) {
    // The org is being changed in this PATCH and the client didn't supply
    // a fresh hideAuthor. Reset to false so a flag chosen for the previous
    // org (or no org) can't silently bleed into the new attribution — the
    // publisher must re-opt in for each org.
    data.hideAuthor = false
  }
  if (b.buildData && typeof b.buildData === "object") {
    if (variantsOverCap(b.buildData)) {
      return c.json({ error: "too_many_variants" }, 400)
    }
    data.buildData = b.buildData as InputJsonValue
    data.hasShards = hasShardsInBuildData(b.buildData)
    // buildData changed → the forma count must move with it. Take the fresh
    // count if the client sent a valid one; otherwise flag the row stale
    // (formaCalcVersion 0) so the recompute backfill corrects it rather than
    // leaving a silently-wrong count behind.
    const forma = parseFormaFields(b)
    if (forma) {
      data.formaCount = forma.formaCount
      data.formaCalcVersion = forma.formaCalcVersion
      data.catalogVersion = forma.catalogVersion
    } else {
      data.formaCalcVersion = FORMA_UNSTAMPED
    }
  }
  // The editor flips itemImageName when the incarnon toggle is applied;
  // accept it on PATCH so the build-overview thumbnail tracks the change.
  // Reject undefined deliberately — PATCH treats absent fields as "don't
  // touch" and only string|null as "write this value". POST differs because
  // every create needs a value, so it coerces non-string to null instead.
  if (typeof b.itemImageName === "string" || b.itemImageName === null) {
    data.itemImageName = b.itemImageName
  }

  const guide = parseGuide(b.guide)
  if (guide) {
    data.hasGuide = guide.hasGuide
    data.buildGuide = {
      upsert: {
        create: { summary: guide.summary, description: guide.description },
        update: { summary: guide.summary, description: guide.description },
      },
    }
  }

  const updated = await prisma.build.update({
    where: { id: existing.id },
    data,
    select: { id: true, slug: true },
  })
  purgeEdge(c, `/builds/${slug}`)
  return c.json(updated)
})

builds.delete("/:slug", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug")

  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const existing = await prisma.build.findUnique({
    where: { slug },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!existing) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(existing, session.user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  await prisma.build.delete({ where: { id: existing.id } })
  purgeEdge(c, `/builds/${slug}`)
  return c.body(null, 204)
})

builds.post("/:slug/fork", rateLimitUser("mutate"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const source = await prisma.build.findUnique({
    where: { slug: c.req.param("slug") },
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      itemUniqueName: true,
      itemCategory: true,
      itemName: true,
      itemImageName: true,
      name: true,
      buildData: true,
      hasShards: true,
      formaCount: true,
      formaCalcVersion: true,
      catalogVersion: true,
    },
  })
  if (!source) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(source, userId))) {
    return c.json({ error: "not_found" }, 404)
  }

  const forkName = `Fork of ${source.name}`.slice(0, MAX_NAME)

  for (let attempt = 0; attempt < SLUG_COLLISION_RETRIES; attempt++) {
    const slug = generateSlug()
    try {
      const created = await prisma.build.create({
        data: {
          slug,
          userId,
          itemUniqueName: source.itemUniqueName,
          itemCategory: source.itemCategory,
          itemName: source.itemName,
          itemImageName: source.itemImageName,
          name: forkName,
          visibility: "PRIVATE",
          buildData: source.buildData as InputJsonValue,
          hasShards: source.hasShards,
          formaCount: source.formaCount,
          formaCalcVersion: source.formaCalcVersion,
          catalogVersion: source.catalogVersion,
          forkedFromId: source.id,
        },
        select: { id: true, slug: true },
      })
      return c.json(created, 201)
    } catch (err: unknown) {
      if (hasPrismaCode(err, "P2002")) continue
      throw err
    }
  }

  return c.json({ error: "slug_collision" }, 500)
})

builds.get("/", edgeCache({ maxAge: 60 }), async (c) => {
  const result = await runList({
    filters: parseListQuery(c),
    ...publicScope(),
    defaultSort: "newest",
  })
  return c.json(result)
})

// Lightweight typeahead for the partner-builds picker. Returns up to
// `limit` builds visible to the requester, matched against name or item
// name. Distinct from `runList` because we don't need pagination, sort
// options, or facets — just enough to populate a combobox.
const SEARCH_DEFAULT_LIMIT = 10
const SEARCH_MAX_LIMIT = 20

builds.get(
  "/search",
  rateLimitUser("search", { includeSafeMethods: true }),
  async (c) => {
    const session = await getSession(c)
    const viewerId = session?.user.id
    const q = (c.req.query("q") ?? "").trim().slice(0, 200)
    if (q.length < 2) return c.json({ builds: [] })

    // Anon traffic isn't keyed by the DB-backed `rateLimitUser` middleware
    // (it short-circuits with no session). Throttle per-IP via the Workers
    // Rate Limiting API binding — runs at the edge before we touch the DB.
    //
    // In production the binding is the only anon defence, so a missing
    // binding (typo in wrangler.toml, removed [[unsafe.bindings]] block) is
    // an operational bug we want to scream about rather than silently
    // open-fail. Outside production we tolerate absence so dev/test don't
    // need the binding wired up.
    if (!viewerId) {
      const blocked = await enforceAnonEdgeLimit(
        c,
        "ANON_SEARCH_LIMITER",
        "rate-limit: ANON_SEARCH_LIMITER binding missing in production — anon /builds/search is unthrottled",
        () => {
          // Without cf-connecting-ip every caller shares the literal key
          // "unknown", which collapses the global anon population into one
          // bucket. That's a fail-closed outcome (the bucket trips fast) so
          // it's preferable to fail-open, but log once so it's diagnosable.
          const ip = c.req.header("cf-connecting-ip")
          if (!ip) console.warn("rate-limit: missing cf-connecting-ip header")
          return ip ?? "unknown"
        },
      )
      if (blocked) return blocked
    }

    const limitRaw = parseInt(c.req.query("limit") ?? "", 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, SEARCH_MAX_LIMIT)
        : SEARCH_DEFAULT_LIMIT

    // PUBLIC only — UNLISTED is "accessible by URL, not enumerable", and a
    // typeahead is enumeration. Viewers can additionally find their own
    // builds regardless of visibility so they can link private/unlisted
    // ones from the editor.
    const rows = await prisma.build.findMany({
      relationLoadStrategy: "join",
      where: {
        AND: [
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { itemName: { contains: q, mode: "insensitive" } },
            ],
          },
          viewerId
            ? {
                OR: [
                  { visibility: BuildVisibility.PUBLIC },
                  { userId: viewerId },
                ],
              }
            : { visibility: BuildVisibility.PUBLIC },
        ],
      },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: LIST_SELECT,
    })
    return c.json({ builds: rows.map(serializeListRow) })
  },
)

async function loadPartnerContext(slug: string, partnerSlug: string) {
  const [own, partner] = await Promise.all([
    prisma.build.findUnique({
      where: { slug },
      select: { id: true, userId: true, organizationId: true },
    }),
    prisma.build.findUnique({
      where: { slug: partnerSlug },
      select: {
        id: true,
        userId: true,
        visibility: true,
        organizationId: true,
      },
    }),
  ])
  return { own, partner }
}

// Edge-cached like the detail route: this fires on every full build-detail
// page view (the "Related builds" strip), so an uncached query here doubles
// the DB hits per anonymous view. Session-cookie requests bypass the cache
// (edgeCache checks the Cookie header), so authenticated viewers still get
// their viewer-specific partner visibility. Accepted staleness, same class as
// the GET /builds list: if a partner flips PUBLIC->PRIVATE or is unlinked, it
// can linger in an anon cache entry for up to maxAge — the partner mutations
// don't purge this path (no tractable per-key eviction). Bounded and low-risk:
// the strip only shows a title/thumbnail, never the loadout.
builds.get("/:slug/partners", edgeCache({ maxAge: 60 }), async (c) => {
  const slug = c.req.param("slug")
  const session = await getSession(c)
  const viewerId = session?.user.id

  // Filter private partners in the DB rather than fetching all rows and
  // filtering in JS — keeps us from over-selecting joined user/org/counts
  // for partners the viewer can't see.
  const partnerVisibility: Prisma.BuildWhereInput = viewerId
    ? {
        OR: [
          {
            visibility: {
              in: [BuildVisibility.PUBLIC, BuildVisibility.UNLISTED],
            },
          },
          { userId: viewerId },
        ],
      }
    : { visibility: { in: [BuildVisibility.PUBLIC, BuildVisibility.UNLISTED] } }

  const build = await prisma.build.findUnique({
    where: { slug },
    // partnerBuilds nests user + organization (via LIST_SELECT), so the default
    // strategy fans out into several queries; join collapses them.
    relationLoadStrategy: "join",
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      partnerBuilds: {
        where: partnerVisibility,
        take: 50,
        select: LIST_SELECT,
      },
    },
  })
  if (!build) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(build, viewerId ?? ""))) {
    return c.json({ error: "not_found" }, 404)
  }

  return c.json({ builds: build.partnerBuilds.map(serializeListRow) })
})

builds.put(
  "/:slug/partners/:partnerSlug",
  rateLimitUser("mutate"),
  async (c) => {
    const session = await getSession(c)
    if (!session?.user) return c.json({ error: "unauthorized" }, 401)
    const viewerId = session.user.id

    const slug = c.req.param("slug")
    const partnerSlug = c.req.param("partnerSlug")
    if (slug === partnerSlug) {
      return c.json({ error: "cannot_link_to_self" }, 400)
    }

    const { own, partner } = await loadPartnerContext(slug, partnerSlug)
    if (!own || !partner) return c.json({ error: "not_found" }, 404)
    // Both sides require mutate rights: the write is symmetric (mirrored
    // below), so a viewer-only check on `partner` would let any user attach
    // their own build to a third party's PUBLIC build and ride its
    // reputation. Mutual ownership is the consent gate.
    const [canMutateOwn, canMutatePartner] = await Promise.all([
      canMutateBuild(own, viewerId),
      canMutateBuild(partner, viewerId),
    ])
    if (!canMutateOwn || !canMutatePartner) {
      return c.json({ error: "forbidden" }, 403)
    }

    // Prisma's implicit self-many-to-many writes only one side of the join
    // row, so we mirror the connect in the same transaction. Connect is
    // idempotent — repeating it is a no-op (prisma#14370).
    await prisma.$transaction([
      prisma.build.update({
        where: { id: own.id },
        data: { partnerBuilds: { connect: { id: partner.id } } },
      }),
      prisma.build.update({
        where: { id: partner.id },
        data: { partnerBuilds: { connect: { id: own.id } } },
      }),
    ])
    return c.body(null, 204)
  },
)

builds.delete(
  "/:slug/partners/:partnerSlug",
  rateLimitUser("mutate"),
  async (c) => {
    const session = await getSession(c)
    if (!session?.user) return c.json({ error: "unauthorized" }, 401)
    const viewerId = session.user.id

    const slug = c.req.param("slug")
    const partnerSlug = c.req.param("partnerSlug")
    const { own, partner } = await loadPartnerContext(slug, partnerSlug)
    if (!own || !partner) return c.json({ error: "not_found" }, 404)
    // Either owner can sever the link.
    const [isOwnOwner, isPartnerOwner] = await Promise.all([
      canMutateBuild(own, viewerId),
      canMutateBuild(partner, viewerId),
    ])
    if (!isOwnOwner && !isPartnerOwner) {
      return c.json({ error: "forbidden" }, 403)
    }

    await prisma.$transaction([
      prisma.build.update({
        where: { id: own.id },
        data: { partnerBuilds: { disconnect: { id: partner.id } } },
      }),
      prisma.build.update({
        where: { id: partner.id },
        data: { partnerBuilds: { disconnect: { id: own.id } } },
      }),
    ])
    return c.body(null, 204)
  },
)

builds.get("/mine", async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const result = await runList({
    filters: parseListQuery(c),
    ...ownerScope(session.user.id),
    defaultSort: "updated",
  })
  return c.json(result)
})

builds.get("/bookmarks", async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  // Bookmarked AND visible to viewer (own / public / unlisted; not others' private).
  const result = await runList({
    filters: parseListQuery(c),
    ...bookmarkedScope(userId),
    defaultSort: "newest",
  })
  return c.json(result)
})

async function getBuildForSocial(slug: string) {
  return prisma.build.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      likeCount: true,
      bookmarkCount: true,
    },
  })
}

// Can this viewer ACT on the build (like / bookmark / fork / link as partner)?
// Deliberately NO admin bypass — and that asymmetry with the GET /:slug view
// check (which does let admins through) is intentional, not an oversight: an
// admin may VIEW any build to moderate it, but must not be able to like,
// bookmark, or fork a PRIVATE build they don't own. Acting on a build is a
// member-level capability gated by real visibility; only viewing is a
// moderation power. Keep this admin-free.
async function canViewerSeeBuild(
  build: {
    userId: string
    visibility: BuildVisibility
    organizationId: string | null
  },
  viewerId: string,
) {
  if (build.visibility === "PUBLIC" || build.visibility === "UNLISTED")
    return true
  if (build.userId === viewerId) return true
  if (build.organizationId) {
    return isOrgMember(build.organizationId, viewerId)
  }
  return false
}

builds.post("/:slug/like", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(build, userId))) {
    return c.json({ error: "not_found" }, 404)
  }
  if (build.userId === userId) {
    return c.json({ error: "cannot_like_own_build" }, 400)
  }

  const likeCount = await toggleSocial(
    "like",
    "add",
    build.id,
    userId,
    build.likeCount,
  )
  return c.json({ hasLiked: true, likeCount })
})

// No visibility re-check here (unlike POST): you can only remove a row you
// already created, so a stale link can't leak anything — the toggle is a no-op
// for a build the viewer never liked.
builds.delete("/:slug/like", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)

  const likeCount = await toggleSocial(
    "like",
    "remove",
    build.id,
    userId,
    build.likeCount,
  )
  return c.json({ hasLiked: false, likeCount })
})

builds.post("/:slug/bookmark", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(build, userId))) {
    return c.json({ error: "not_found" }, 404)
  }
  // Unlike POST /like there's no self-bookmark guard: bookmarking your own
  // Build to save it for later is allowed (see CONTEXT.md — Bookmark, unlike
  // Like, has no "not your own" rule).

  const bookmarkCount = await toggleSocial(
    "bookmark",
    "add",
    build.id,
    userId,
    build.bookmarkCount,
  )
  return c.json({ hasBookmarked: true, bookmarkCount })
})

// No visibility re-check here — same reasoning as DELETE /:slug/like.
builds.delete("/:slug/bookmark", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)

  const bookmarkCount = await toggleSocial(
    "bookmark",
    "remove",
    build.id,
    userId,
    build.bookmarkCount,
  )
  return c.json({ hasBookmarked: false, bookmarkCount })
})

builds.get("/:slug", edgeCache({ maxAge: 60 }), async (c) => {
  const slug = c.req.param("slug")

  // Fast path for the link-unfurl Worker (apps/web/worker/index.ts): skip the
  // heavy `buildData` JSON column, the guide body, the session lookup, and
  // the viewer-state queries. Only PUBLIC / UNLISTED builds are visible
  // anonymously, and the Worker further filters to PUBLIC before injecting
  // meta. This shrinks the edge-cached payload by ~10–50× for embeds.
  if (c.req.query("embed") === "1") {
    const slim = await prisma.build.findUnique({
      where: { slug },
      relationLoadStrategy: "join",
      select: {
        slug: true,
        name: true,
        description: true,
        visibility: true,
        hideAuthor: true,
        likeCount: true,
        viewCount: true,
        itemName: true,
        itemCategory: true,
        itemUniqueName: true,
        itemImageName: true,
        user: { select: { name: true, username: true, displayUsername: true } },
        organization: { select: { name: true } },
        buildGuide: { select: { summary: true } },
      },
    })
    if (
      !slim ||
      (slim.visibility !== "PUBLIC" && slim.visibility !== "UNLISTED")
    )
      return c.json({ error: "not_found" }, 404)
    return c.json({
      name: slim.name,
      description: slim.description,
      visibility: slim.visibility,
      hideAuthor: slim.hideAuthor,
      likeCount: slim.likeCount,
      viewCount: slim.viewCount,
      item: {
        name: slim.itemName,
        category: slim.itemCategory,
        uniqueName: slim.itemUniqueName,
        imageName: slim.itemImageName,
      },
      user: slim.user,
      organization: slim.organization,
      guide: slim.buildGuide ? { summary: slim.buildGuide.summary } : null,
    })
  }

  const [session, build] = await Promise.all([
    getSession(c),
    prisma.build.findUnique({
      where: { slug },
      // Fold user + organization + buildGuide into one LATERAL-join SELECT
      // rather than a query-per-relation. The detail page was the single
      // largest source of DB query volume (one view = build + guide + author +
      // org as four separate SELECTs); see _build-list.ts for the rationale.
      relationLoadStrategy: "join",
      include: DETAIL_INCLUDE,
    }),
  ])

  if (!build) return c.json({ error: "not_found" }, 404)

  const viewerId = session?.user.id
  // Resolve org membership once — both the view check and the owner/mutate
  // check below need the same (org, viewer) answer.
  const viewerIsOrgMember =
    viewerId != null && build.organizationId != null
      ? await isOrgMember(build.organizationId, viewerId)
      : false
  // Admins bypass visibility so they can moderate any build — without this, an
  // admin who sets someone else's build to PRIVATE immediately loses the right
  // to view it back and the viewer 404s. This is a VIEW-only power: the social
  // paths (like/bookmark/fork) go through canViewerSeeBuild, which has no admin
  // bypass on purpose, so an admin can read but not act on a private build.
  const isAdmin = session?.user.isAdmin === true
  const canView =
    build.visibility === "PUBLIC" ||
    build.visibility === "UNLISTED" ||
    (viewerId != null && build.userId === viewerId) ||
    viewerIsOrgMember ||
    isAdmin

  if (!canView) return c.json({ error: "not_found" }, 404)

  await maybeIncrementView(c, build.id, build.slug, viewerId, build.userId)

  let viewerHasLiked = false
  let viewerHasBookmarked = false
  if (viewerId) {
    const [like, bookmark] = await Promise.all([
      prisma.buildLike.findUnique({
        where: { userId_buildId: { userId: viewerId, buildId: build.id } },
        select: { id: true },
      }),
      prisma.buildBookmark.findUnique({
        where: { userId_buildId: { userId: viewerId, buildId: build.id } },
        select: { id: true },
      }),
    ])
    viewerHasLiked = like != null
    viewerHasBookmarked = bookmark != null
  }

  // Mirrors `canMutateBuild` but reuses the membership resolved above.
  const isOwner =
    viewerId != null && (build.userId === viewerId || viewerIsOrgMember)

  // Embed loads (?view=0) increment no view and set no cookie, so an anonymous
  // response is fully shareable — let the browser cache it too, not just the
  // edge. A guide page with many embeds (and repeat visits) then skips the
  // refetch entirely. Gate on no-session so a personalized (owner/like/bookmark)
  // payload is never publicly cached; Vary: Cookie stops a logged-in viewer from
  // reusing the anonymous body from their own HTTP cache.
  if (!session && c.req.query("view") === "0") {
    c.header("Cache-Control", "public, max-age=300")
    c.header("Vary", "Cookie")
  }

  return c.json(
    serializeBuildDetail(build, {
      isOwner,
      hasLiked: viewerHasLiked,
      hasBookmarked: viewerHasBookmarked,
    }),
  )
})

const VIEW_COOKIE_MAX_AGE = 12 * 60 * 60 // 12h

async function maybeIncrementView(
  c: Context,
  buildId: string,
  slug: string,
  viewerId: string | undefined,
  ownerId: string,
) {
  if (viewerId && viewerId === ownerId) return
  // The link-unfurl Worker (apps/web/worker/index.ts) appends ?embed=1 when it
  // hydrates OG meta tags for bot scrapes. Those calls forward no cookies, so
  // without this guard every Discord unfurl would inflate
  // viewCount — and the Set-Cookie we'd attach would also defeat the Worker's
  // edge cache. Skip the side effect (and the cookie) entirely.
  if (c.req.query("embed") === "1") return
  // The embed viewer (apps/web/src/embed-main.tsx) appends ?view=0. An embed
  // impression on a third-party guide page is not a build view, so skip the
  // bump. Skipping also means no Set-Cookie, which lets the detail handler mark
  // the response browser-cacheable (see below).
  if (c.req.query("view") === "0") return
  const cookieName = `vw_${slug}`
  if (getCookie(c, cookieName)) return
  registerBackgroundWork(
    prisma.$executeRaw`
      UPDATE builds SET "viewCount" = "viewCount" + 1 WHERE id = ${buildId}
    `.catch((err) => console.error("view count update failed", err)),
  )
  // Per-day bucket for the trailing-30-day "trending" sort. Same dedup/embed
  // guards as the all-time counter above, so bots and iframes don't inflate it.
  registerBackgroundWork(
    prisma.$executeRaw`
      INSERT INTO build_view_days ("buildId", day, count)
      VALUES (${buildId}, CURRENT_DATE, 1)
      ON CONFLICT ("buildId", day)
        DO UPDATE SET count = build_view_days.count + 1
    `.catch((err) => console.error("view day bucket update failed", err)),
  )
  // Opportunistic prune so the bucket table stays bounded to the window. No cron
  // needed: counted views are already rare (12h dedup), and a ~2% sample keeps
  // the table trimmed without a DELETE on every request.
  if (Math.random() < 0.02) {
    registerBackgroundWork(
      prisma.$executeRaw`
        DELETE FROM build_view_days WHERE day < CURRENT_DATE - INTERVAL '31 days'
      `.catch((err) => console.error("view day prune failed", err)),
    )
  }
  const isProd = process.env.NODE_ENV === "production"
  setCookie(c, cookieName, "1", {
    path: "/",
    maxAge: VIEW_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: isProd ? "None" : "Lax",
    secure: isProd,
  })
}

async function canMutateBuild(
  existing: { userId: string; organizationId: string | null },
  sessionUserId: string,
) {
  if (existing.userId === sessionUserId) return true
  if (existing.organizationId)
    return isOrgMember(existing.organizationId, sessionUserId)
  return false
}

async function isOrgMember(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  })
  return membership != null
}

type OrgAssignment =
  | { ok: true; value: string | null }
  | { ok: false; error: string; status: 400 | 403 }

async function resolveOrgAssignment(
  raw: unknown,
  userId: string,
): Promise<OrgAssignment> {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw !== "string")
    return { ok: false, error: "invalid_organization_id", status: 400 }
  if (!(await isOrgMember(raw, userId)))
    return { ok: false, error: "not_org_member", status: 403 }
  return { ok: true, value: raw }
}
