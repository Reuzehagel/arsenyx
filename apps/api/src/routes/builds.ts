import { isBuildVisibility } from "@arsenyx/shared/api/build-dto"
import { LIST_DEFAULT_SORTS } from "@arsenyx/shared/api/build-list"
import {
  BUILD_NAME_MAX,
  BUILD_SEARCH_Q_MAX,
  GUIDE_SUMMARY_MAX,
} from "@arsenyx/shared/api/limits"
import {
  hasShardsInBuildData,
  variantsOverCap,
} from "@arsenyx/shared/warframe/build-data"
import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import {
  FORMA_CALC_VERSION,
  FORMA_UNSTAMPED,
  MAX_FORMA_COUNT,
} from "@arsenyx/shared/warframe/forma"
import { Hono, type Context } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { customAlphabet } from "nanoid"

import {
  poolQuery,
  prisma,
  registerBackgroundWork,
  sometimesInBackground,
} from "../db"
import { isHttps } from "../env"
import type { Prisma } from "../generated/prisma/client"
import type { BuildVisibility } from "../generated/prisma/enums"
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace"
import { edgeCache } from "../lib/edge-cache"
import { DETAIL_MARKERS } from "../lib/measure"
import { getSession, requireUser } from "../lib/session"
import {
  hasPrismaCode,
  httpError,
  parseJsonBody,
  trimToMax,
} from "../lib/validate"
import { enforceAnonSearchLimit, rateLimitUser } from "../middleware/rate-limit"
import {
  DETAIL_INCLUDE,
  LIST_SELECT,
  parseListQuery,
  runList,
  serializeBuildDetail,
  serializeListRow,
} from "./_build-list"
import {
  asVariantMap,
  isVariantIndex,
  partnerSelect,
  serializePartners,
} from "./_build-partners"
import {
  describeEdit,
  MAX_REVISION_NOTE,
  pruneRevisions,
  readRevisions,
  toBuildUpdate,
  type BuildPatch,
  type GuideInput,
} from "./_build-revisions"
import {
  deleteBuild,
  detailVariant,
  metaFromSnapshot,
  invalidateBuilds,
  readAnonSnapshot,
} from "./_build-snapshot"
import { setLike, clearLike, toggleBookmark } from "./_build-social"
import {
  bookmarkedScope,
  canActOnBuild,
  canMutateBuild,
  isOrgMember,
  mutableScope,
  ownerScope,
  publicScope,
  searchScope,
  viewerAccess,
} from "./_build-visibility"

export const builds = new Hono()

const MAX_DESCRIPTION = 2000
const MAX_GUIDE_DESCRIPTION = 50_000

// Edge-cache TTLs for the anonymous public reads (see lib/edge-cache.ts).
//
// Every miss still runs the Worker handler — an anonymous detail miss is a KV
// snapshot read, a list/profile miss plain SQL on the request's pool (see
// db.ts) — so TTL is the main lever on API CPU. Raised 10 → 120 → 600 (2026-10): at 120s
// only ~5.5% of edge-cache lookups hit and ~73% found an entry that had just
// expired, so the API Worker sat over the Workers Paid 30M CPU-ms allowance.
//
// DETAIL is the safe one to raise: invalidateBuilds evicts all its variants on
// write, and authenticated editors bypass the cache entirely, so owners always
// see their own writes. The residual staleness is that purges are colo-local —
// other colos serve stale for up to the TTL.
//
// Second, less obvious cost: a cache HIT never runs the handler, so it never
// runs maybeIncrementView. Raising this therefore undercounts views by roughly
// the hit rate. Judged acceptable because views are already deduped per browser
// via the `vw_<slug>` cookie, so the metric was never a raw impression count —
// but if viewCount fidelity ever matters more than CPU, this is the dial.
const DETAIL_TTL = 600

// For the list-shaped responses — GET /builds and GET /:slug/partners (both
// projected through LIST_SELECT), plus the GET /users directory. NONE is purged on write (purgeEdge), so a
// PUBLIC->PRIVATE flip or a delete can linger for the whole TTL; that is why
// this stays well under DETAIL_TTL. A just-hidden build lingering in lists for
// 2 min was judged fine. The detail payload also embeds the partner strip; a
// build's PATCH/DELETE refreshes its partners' detail, so there a partner
// going PRIVATE lingers only in other colos' edge caches, for up to
// DETAIL_TTL. Accepted: the strip shows a title and thumbnail, never a
// loadout.
export const LIST_TTL = 120

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

function parseGuide(input: unknown): GuideInput | null {
  if (!input || typeof input !== "object") return null
  const g = input as Record<string, unknown>
  return {
    summary: trimToMax(g.summary, GUIDE_SUMMARY_MAX),
    description: trimToMax(g.description, MAX_GUIDE_DESCRIPTION),
  }
}

/** `hideAuthor` only means something on an org-published build; the one
 *  place it is normalized, at write time. */
const hideAuthorFor = (requested: unknown, organizationId: string | null) =>
  organizationId !== null && requested === true

// URL-safe alphabet without visually-confusing chars (no 0/O, 1/l/I).
const generateSlug = customAlphabet(
  "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
  10,
)

// With a 56-char alphabet and 10-char slugs the collision space is ~3e17; 5
// retries on the @@unique collision is dramatically more than enough.
const SLUG_COLLISION_RETRIES = 5

/** Creates a build under a fresh slug, with the CREATED anchor of its edit
 *  log: Build.createdAt says when, but only that row says who, which for an
 *  org build is not the same question. */
async function createBuild(
  data: Omit<Prisma.BuildUncheckedCreateInput, "slug" | "revisions">,
  revisionNote: string | null,
) {
  for (let attempt = 0; attempt < SLUG_COLLISION_RETRIES; attempt++) {
    try {
      return await prisma.build.create({
        data: {
          ...data,
          slug: generateSlug(),
          revisions: {
            create: {
              editorId: data.userId,
              kind: "CREATED",
              note: revisionNote,
            },
          },
        },
        select: { id: true, slug: true },
      })
    } catch (err: unknown) {
      if (hasPrismaCode(err, "P2002")) continue
      throw err
    }
  }
  throw httpError(500, "slug_collision")
}

builds.post("/", rateLimitUser("mutate"), async (c) => {
  const user = await requireUser(c)
  const b = await parseJsonBody(c)

  const itemUniqueName =
    typeof b.itemUniqueName === "string" ? b.itemUniqueName.trim() : ""
  const itemCategory = typeof b.itemCategory === "string" ? b.itemCategory : ""
  const itemName = typeof b.itemName === "string" ? b.itemName.trim() : ""
  const itemImageName =
    typeof b.itemImageName === "string" ? b.itemImageName : null
  const name = typeof b.name === "string" ? b.name.trim() : ""
  const userDefault = (user as { defaultBuildVisibility?: string })
    .defaultBuildVisibility
  const visibility: BuildVisibility = isBuildVisibility(b.visibility)
    ? b.visibility
    : isBuildVisibility(userDefault)
      ? userDefault
      : "PUBLIC"

  if (!itemUniqueName) return c.json({ error: "missing_item_unique_name" }, 400)
  if (!isValidCategory(itemCategory))
    return c.json({ error: "invalid_category" }, 400)
  if (!itemName) return c.json({ error: "missing_item_name" }, 400)
  if (!name || name.length > BUILD_NAME_MAX)
    return c.json({ error: "invalid_name" }, 400)
  if (!b.buildData || typeof b.buildData !== "object") {
    return c.json({ error: "invalid_build_data" }, 400)
  }
  if (variantsOverCap(b.buildData)) {
    return c.json({ error: "too_many_variants" }, 400)
  }

  const buildData = b.buildData as InputJsonValue
  const guide = parseGuide(b.guide)
  const hasGuide = guide?.summary != null || guide?.description != null
  // Lenient: a client that doesn't send a count (or sends a bad one) gets a
  // sentinel `formaCalcVersion: 0` row, which the recompute backfill picks up.
  const forma = parseFormaFields(b) ?? {
    formaCount: 0,
    formaCalcVersion: FORMA_UNSTAMPED,
    catalogVersion: null,
  }

  const organizationId = await resolveOrgAssignment(b.organizationId, user.id)

  const created = await createBuild(
    {
      userId: user.id,
      itemUniqueName,
      itemCategory,
      itemName,
      itemImageName,
      name,
      description: trimToMax(b.description, MAX_DESCRIPTION),
      visibility,
      organizationId,
      hideAuthor: hideAuthorFor(b.hideAuthor, organizationId),
      buildData,
      hasShards: hasShardsInBuildData(buildData),
      ...forma,
      hasGuide,
      buildGuide: hasGuide ? { create: guide! } : undefined,
    },
    trimToMax(b.revisionNote, MAX_REVISION_NOTE),
  )
  return c.json(created, 201)
})

builds.patch("/:slug", rateLimitUser("mutate"), async (c) => {
  const user = await requireUser(c)

  const existing = await prisma.build.findUnique({
    where: { slug: c.req.param("slug") },
    // buildData is pulled (5-80 KB) so the revision written below can diff
    // against it. PATCH is rare next to reads, and there is no other way to
    // know what changed — the client sends the whole document, not a patch.
    select: {
      id: true,
      userId: true,
      organizationId: true,
      buildData: true,
      name: true,
      visibility: true,
      // The editor sends `guide` on every save whether or not it changed, so
      // "was the guide edited" is answered by comparing content.
      buildGuide: { select: { summary: true, description: true } },
    },
  })
  if (!existing) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(existing, user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  const b = await parseJsonBody(c)

  const patch: BuildPatch = {}
  if (typeof b.name === "string") {
    const name = b.name.trim()
    if (!name || name.length > BUILD_NAME_MAX)
      return c.json({ error: "invalid_name" }, 400)
    patch.name = name
  }
  if (typeof b.description === "string" || b.description === null) {
    patch.description = trimToMax(b.description, MAX_DESCRIPTION)
  }
  if (isBuildVisibility(b.visibility)) {
    patch.visibility = b.visibility
  }
  if (
    (b.organizationId === null || typeof b.organizationId === "string") &&
    b.organizationId !== existing.organizationId
  ) {
    // Only the author may move a build between orgs: a co-member moving it
    // into another org of theirs would hand edit rights to strangers.
    if (existing.userId !== user.id) {
      return c.json({ error: "forbidden" }, 403)
    }
    patch.organizationId = await resolveOrgAssignment(b.organizationId, user.id)
  }
  // Against the org after this PATCH. An org change without a fresh
  // hideAuthor resets it, so a flag chosen for the previous org (or none)
  // can't bleed into the new attribution — the publisher re-opts in per org.
  if (typeof b.hideAuthor === "boolean" || patch.organizationId !== undefined) {
    patch.hideAuthor = hideAuthorFor(
      b.hideAuthor,
      patch.organizationId !== undefined
        ? patch.organizationId
        : existing.organizationId,
    )
  }
  if (b.buildData && typeof b.buildData === "object") {
    if (variantsOverCap(b.buildData)) {
      return c.json({ error: "too_many_variants" }, 400)
    }
    patch.buildData = b.buildData as InputJsonValue
    patch.hasShards = hasShardsInBuildData(b.buildData)
    // buildData changed → the forma count must move with it. Take the fresh
    // count if the client sent a valid one; otherwise flag the row stale
    // (formaCalcVersion 0) so the recompute backfill corrects it rather than
    // leaving a silently-wrong count behind.
    Object.assign(
      patch,
      parseFormaFields(b) ?? { formaCalcVersion: FORMA_UNSTAMPED },
    )
  }
  // The editor flips itemImageName when the incarnon toggle is applied, so
  // the build-overview thumbnail tracks it. Absent means "don't touch";
  // only string|null writes.
  if (typeof b.itemImageName === "string" || b.itemImageName === null) {
    patch.itemImageName = b.itemImageName
  }
  const guide = parseGuide(b.guide)
  if (guide) patch.guide = guide

  // One revision per accepted PATCH, in the same statement as the update so a
  // save can never land without its log entry.
  const updated = await prisma.build.update({
    where: { id: existing.id },
    data: {
      ...toBuildUpdate(patch),
      revisions: {
        create: {
          editorId: user.id,
          kind: "EDITED",
          note: trimToMax(b.revisionNote, MAX_REVISION_NOTE),
          changes: describeEdit(existing, patch) as unknown as InputJsonValue,
        },
      },
    },
    // Partner slugs come back from the update itself: a separate read after
    // the commit could fail and 500 a save that already landed.
    select: { id: true, slug: true, partnerBuilds: { select: { slug: true } } },
  })
  pruneRevisions(existing.id)
  const { partnerBuilds, ...result } = updated
  invalidateBuilds(c, [result.slug, ...partnerBuilds.map((p) => p.slug)])
  return c.json(result)
})

builds.get("/:slug/revisions", async (c) => {
  const user = await requireUser(c)

  const build = await prisma.build.findUnique({
    where: { slug: c.req.param("slug") },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!build) return c.json({ error: "not_found" }, 404)
  // Same gate as editing: if you can change the build you can see who else
  // has — which also covers solo builds (the author sees their own log).
  if (!(await canMutateBuild(build, user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  return c.json(await readRevisions(build.id))
})

builds.delete("/:slug", rateLimitUser("mutate"), async (c) => {
  const user = await requireUser(c)

  const existing = await prisma.build.findUnique({
    where: { slug: c.req.param("slug") },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!existing) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(existing, user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  await deleteBuild(c, { id: existing.id })
  return c.body(null, 204)
})

builds.post("/:slug/fork", rateLimitUser("mutate"), async (c) => {
  const user = await requireUser(c)

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
  if (!source || !(await canActOnBuild(source, user.id))) {
    return c.json({ error: "not_found" }, 404)
  }

  const created = await createBuild(
    {
      userId: user.id,
      itemUniqueName: source.itemUniqueName,
      itemCategory: source.itemCategory,
      itemName: source.itemName,
      itemImageName: source.itemImageName,
      name: `Fork of ${source.name}`.slice(0, BUILD_NAME_MAX),
      visibility: "PRIVATE",
      buildData: source.buildData as InputJsonValue,
      hasShards: source.hasShards,
      formaCount: source.formaCount,
      formaCalcVersion: source.formaCalcVersion,
      catalogVersion: source.catalogVersion,
      forkedFromId: source.id,
    },
    null,
  )
  return c.json(created, 201)
})

builds.get("/", edgeCache({ maxAge: LIST_TTL }), async (c) => {
  const result = await runList({
    filters: parseListQuery(c),
    ...publicScope(),
    defaultSort: LIST_DEFAULT_SORTS.public,
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
    const q = (c.req.query("q") ?? "").trim().slice(0, BUILD_SEARCH_Q_MAX)
    if (q.length < 2) return c.json({ builds: [] })

    // Anon traffic isn't keyed by the DB-backed `rateLimitUser` middleware
    // (it short-circuits with no session). Throttle per-IP via the Workers
    // Rate Limiting API binding — runs at the edge before we touch the DB.
    const blocked = await enforceAnonSearchLimit(c, "/builds/search")
    if (blocked) return blocked

    const limitRaw = parseInt(c.req.query("limit") ?? "", 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, SEARCH_MAX_LIMIT)
        : SEARCH_DEFAULT_LIMIT

    // `mine=1` narrows to builds the requester may mutate. The partner picker
    // uses this: linking requires mutual ownership (PUT
    // /:slug/partners/:partnerSlug), so offering other people's builds there
    // only sets up a guaranteed 403.
    const scope =
      c.req.query("mine") === "1"
        ? await mutableScope((await requireUser(c)).id)
        : searchScope(session?.user.id)

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
          scope,
        ],
      },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: LIST_SELECT,
    })
    return c.json({ builds: rows.map((r) => serializeListRow(r)) })
  },
)

async function loadPartnerContext(slug: string, partnerSlug: string) {
  const select = {
    id: true,
    userId: true,
    organizationId: true,
    partnerVariants: true,
  } as const
  const [own, partner] = await Promise.all([
    prisma.build.findUnique({ where: { slug }, select }),
    prisma.build.findUnique({ where: { slug: partnerSlug }, select }),
  ])
  return { own, partner }
}

// The partner strip on its own. The full detail response (GET /:slug) carries
// the same rows as `partners`, so the build page doesn't call this; it serves
// the guide editor and refetches after partner mutations. Edge-cached and not
// purged (see LIST_TTL); session-cookie requests bypass the cache, so signed-in
// viewers get their viewer-specific rows.
//
// Gated like GET /:slug, admin moderation view included: an admin who can open
// a PRIVATE build sees the strip the detail payload already embeds. The rows
// themselves have no admin bypass (visiblePartnerScope), same as there.
builds.get("/:slug/partners", edgeCache({ maxAge: LIST_TTL }), async (c) => {
  const viewerId = (await getSession(c))?.user.id

  const build = await prisma.build.findUnique({
    where: { slug: c.req.param("slug") },
    relationLoadStrategy: "join",
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      ...partnerSelect(viewerId),
    },
  })
  if (!build) return c.json({ error: "not_found" }, 404)
  if (!(await viewerAccess(c, build, viewerId)).canView) {
    return c.json({ error: "not_found" }, 404)
  }
  return c.json({ builds: serializePartners(build) })
})

// Persist the owner's display order for its partner strip. One-sided: only
// the owning build's `partnerOrder` is written (the partner side keeps its
// own order), so this needs mutate rights on `own` alone — unlike link/unlink,
// which mutate both builds and require mutual ownership. The body is a list of
// partner build ids; we store it verbatim after intersecting with the current
// links so a stale/foreign id can't be smuggled in.
//
// MUST stay registered before "/:slug/partners/:partnerSlug" (pinned by
// route-order.test.ts): Hono matches in registration order, so the param
// route would otherwise capture `order` as a partnerSlug.
builds.put("/:slug/partners/order", rateLimitUser("mutate"), async (c) => {
  const user = await requireUser(c)

  const slug = c.req.param("slug")
  const order = (await parseJsonBody(c, { maxBytes: 8 * 1024 })).order
  if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
    return c.json({ error: "invalid_order" }, 400)
  }

  const own = await prisma.build.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      partnerBuilds: { select: { id: true } },
    },
  })
  if (!own) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(own, user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  // Keep only ids that are actually linked, in the requested order; drop
  // unknowns, then dedup (Set preserves insertion order). Partners omitted from
  // the request keep appending after these (serializePartners' fallback).
  const linked = new Set(own.partnerBuilds.map((p) => p.id))
  const nextOrder = [
    ...new Set((order as string[]).filter((id) => linked.has(id))),
  ]

  await prisma.build.update({
    where: { id: own.id },
    data: { partnerOrder: nextOrder },
  })
  // The detail payload embeds the partner strip.
  invalidateBuilds(c, [slug])
  return c.body(null, 204)
})

// Persist which variant of a partner build this build's strip should link to
// (issue #302). One-sided like `partnerOrder` — only the owning build's
// `partnerVariants` map is written, so mutate rights on `own` alone suffice.
// `variant` is a 0-based index into the partner's variants; 0 or null clears
// the entry (default variant). No registration-order hazard with the
// two-segment partner routes: this path has an extra segment.
builds.put(
  "/:slug/partners/:partnerSlug/variant",
  rateLimitUser("mutate"),
  async (c) => {
    const user = await requireUser(c)

    const raw = (await parseJsonBody(c, { maxBytes: 1024 })).variant
    if (raw !== null && !isVariantIndex(raw)) {
      return c.json({ error: "invalid_variant" }, 400)
    }
    const variant = raw ?? 0

    const slug = c.req.param("slug")
    const partnerSlug = c.req.param("partnerSlug")
    const own = await prisma.build.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        partnerVariants: true,
        // Narrowed to the one partner we're targeting — doubles as the
        // "is it actually linked" check.
        partnerBuilds: { where: { slug: partnerSlug }, select: { id: true } },
      },
    })
    if (!own) return c.json({ error: "not_found" }, 404)
    if (!(await canMutateBuild(own, user.id))) {
      return c.json({ error: "forbidden" }, 403)
    }
    const partner = own.partnerBuilds[0]
    if (!partner) return c.json({ error: "not_found" }, 404)

    const map = asVariantMap(own.partnerVariants)
    if (variant > 0) map[partner.id] = variant
    else delete map[partner.id]

    await prisma.build.update({
      where: { id: own.id },
      data: { partnerVariants: map as InputJsonValue },
    })
    invalidateBuilds(c, [slug])
    return c.body(null, 204)
  },
)

builds.put(
  "/:slug/partners/:partnerSlug",
  rateLimitUser("mutate"),
  async (c) => {
    const user = await requireUser(c)

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
      canMutateBuild(own, user.id),
      canMutateBuild(partner, user.id),
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
    invalidateBuilds(c, [slug, partnerSlug])
    return c.body(null, 204)
  },
)

builds.delete(
  "/:slug/partners/:partnerSlug",
  rateLimitUser("mutate"),
  async (c) => {
    const user = await requireUser(c)

    const slug = c.req.param("slug")
    const partnerSlug = c.req.param("partnerSlug")
    const { own, partner } = await loadPartnerContext(slug, partnerSlug)
    if (!own || !partner) return c.json({ error: "not_found" }, 404)
    // Either owner can sever the link.
    const [isOwnOwner, isPartnerOwner] = await Promise.all([
      canMutateBuild(own, user.id),
      canMutateBuild(partner, user.id),
    ])
    if (!isOwnOwner && !isPartnerOwner) {
      return c.json({ error: "forbidden" }, 403)
    }
    // "Either owner" only applies to an existing link — without this, owning
    // any build let a caller write (and bump updatedAt on) any other build.
    const linked = await prisma.build.count({
      where: { id: own.id, partnerBuilds: { some: { id: partner.id } } },
    })
    if (linked === 0) return c.json({ error: "not_found" }, 404)

    // Sweep the severed link's variant targets on both sides while we're
    // already writing both rows — stale entries are harmless on read, but
    // they'd silently re-apply if the same pair ever re-linked.
    const ownVariants = asVariantMap(own.partnerVariants)
    delete ownVariants[partner.id]
    const partnerVariants = asVariantMap(partner.partnerVariants)
    delete partnerVariants[own.id]

    await prisma.$transaction([
      prisma.build.update({
        where: { id: own.id },
        data: {
          partnerBuilds: { disconnect: { id: partner.id } },
          partnerVariants: ownVariants as InputJsonValue,
        },
      }),
      prisma.build.update({
        where: { id: partner.id },
        data: {
          partnerBuilds: { disconnect: { id: own.id } },
          partnerVariants: partnerVariants as InputJsonValue,
        },
      }),
    ])
    invalidateBuilds(c, [slug, partnerSlug])
    return c.body(null, 204)
  },
)

builds.get("/mine", async (c) => {
  const user = await requireUser(c)
  const result = await runList({
    filters: parseListQuery(c),
    ...ownerScope(user.id),
    defaultSort: LIST_DEFAULT_SORTS.mine,
  })
  return c.json(result)
})

builds.get("/bookmarks", async (c) => {
  const user = await requireUser(c)
  const result = await runList({
    filters: parseListQuery(c),
    ...bookmarkedScope(user.id),
    defaultSort: LIST_DEFAULT_SORTS.bookmarks,
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
      dislikeCount: true,
      bookmarkCount: true,
    },
  })
}

// POST sets (or flips to) a Like / Dislike; DELETE clears either one, whichever
// way it went, so the response state is always known without a re-read.
for (const [path, value] of [
  ["like", 1],
  ["dislike", -1],
] as const) {
  builds.post(`/:slug/${path}`, rateLimitUser("social"), async (c) => {
    const user = await requireUser(c)

    const build = await getBuildForSocial(c.req.param("slug"))
    if (!build || !(await canActOnBuild(build, user.id))) {
      return c.json({ error: "not_found" }, 404)
    }
    if (build.userId === user.id) {
      return c.json({ error: "cannot_like_own_build" }, 400)
    }

    const counts = await setLike(value, build.id, user.id, {
      likeCount: build.likeCount,
      dislikeCount: build.dislikeCount,
    })
    return c.json({
      hasLiked: value === 1,
      hasDisliked: value === -1,
      ...counts,
    })
  })

  // No visibility re-check here (unlike POST): you can only remove a row you
  // already created, so a stale link can't leak anything — the clear is a
  // no-op for a build the viewer never liked or disliked.
  builds.delete(`/:slug/${path}`, rateLimitUser("social"), async (c) => {
    const user = await requireUser(c)

    const build = await getBuildForSocial(c.req.param("slug"))
    if (!build) return c.json({ error: "not_found" }, 404)

    const counts = await clearLike(build.id, user.id, {
      likeCount: build.likeCount,
      dislikeCount: build.dislikeCount,
    })
    return c.json({ hasLiked: false, hasDisliked: false, ...counts })
  })
}

builds.post("/:slug/bookmark", rateLimitUser("social"), async (c) => {
  const user = await requireUser(c)

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build || !(await canActOnBuild(build, user.id))) {
    return c.json({ error: "not_found" }, 404)
  }
  // No self-bookmark guard: bookmarking your own Build to save it for later is
  // allowed (GLOSSARY.md — Bookmark, unlike Like, has no "not your own" rule).

  const bookmarkCount = await toggleBookmark(
    "add",
    build.id,
    user.id,
    build.bookmarkCount,
  )
  return c.json({ hasBookmarked: true, bookmarkCount })
})

// No visibility re-check here — same reasoning as DELETE /:slug/like.
builds.delete("/:slug/bookmark", rateLimitUser("social"), async (c) => {
  const user = await requireUser(c)

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)

  const bookmarkCount = await toggleBookmark(
    "remove",
    build.id,
    user.id,
    build.bookmarkCount,
  )
  return c.json({ hasBookmarked: false, bookmarkCount })
})

builds.get("/:slug", edgeCache({ maxAge: DETAIL_TTL }), async (c) => {
  const slug = c.req.param("slug")
  const variant = detailVariant(c)
  // Memoized; rateLimitAnonRead already resolved it for this request.
  const session = await getSession(c)

  // Anonymous: served from the KV snapshot, so a miss here never constructs
  // a PrismaClient.
  if (!session?.user) {
    const snap = await readAnonSnapshot(c, slug)
    if (!snap) return c.json({ error: "not_found" }, 404)
    if (variant === "meta") {
      return c.json(metaFromSnapshot(JSON.parse(snap.text)))
    }
    if (variant === "noView") {
      // No view, no cookie, so the browser may cache it too (Vary: Cookie
      // keeps it off signed-in loads).
      const { partners: _, ...body } = JSON.parse(snap.text)
      c.header("Cache-Control", "public, max-age=300")
      c.header("Vary", "Cookie")
      return c.json(body)
    }
    maybeIncrementView(c, snap.meta.id, slug, false)
    return c.body(snap.text, 200, { "Content-Type": "application/json" })
  }

  console.log(DETAIL_MARKERS.live)
  const build = await prisma.build.findUnique({
    where: { slug },
    relationLoadStrategy: "join",
    include: DETAIL_INCLUDE,
  })
  if (!build) return c.json({ error: "not_found" }, 404)

  const viewerId = session.user.id
  const access = await viewerAccess(c, build, viewerId)
  if (!access.canView) return c.json({ error: "not_found" }, 404)

  maybeIncrementView(c, build.id, build.slug, build.userId === viewerId)

  // Partner strip rides along so a page view is one cache miss instead of two
  // (each miss pays per-request Prisma client + connection setup). The embed
  // viewer never renders it, so it skips the query.
  const [like, bookmark, partners] = await Promise.all([
    prisma.buildLike.findUnique({
      where: { userId_buildId: { userId: viewerId, buildId: build.id } },
      select: { value: true },
    }),
    prisma.buildBookmark.findUnique({
      where: { userId_buildId: { userId: viewerId, buildId: build.id } },
      select: { id: true },
    }),
    variant === "noView"
      ? null
      : prisma.build.findUnique({
          where: { id: build.id },
          relationLoadStrategy: "join",
          select: partnerSelect(viewerId),
        }),
  ])

  return c.json({
    ...serializeBuildDetail(
      build,
      {
        isOwner: access.canMutate,
        hasLiked: like?.value === 1,
        hasDisliked: like?.value === -1,
        hasBookmarked: bookmark != null,
      },
      access.canMutate || access.isAdmin,
    ),
    ...(partners && { partners: serializePartners(partners) }),
  })
})

const VIEW_COOKIE_MAX_AGE = 12 * 60 * 60 // 12h

/** Counts a view of the full page (never the meta or noView variants, never the
 *  author's own), deduped per browser by a 12h `vw_<slug>` cookie. */
function maybeIncrementView(
  c: Context,
  buildId: string,
  slug: string,
  viewerIsAuthor: boolean,
) {
  if (viewerIsAuthor || detailVariant(c) !== "full") return
  const cookieName = `vw_${slug}`
  if (getCookie(c, cookieName)) return
  // All-time counter plus the per-day bucket for the trailing-30-day "trending"
  // sort, in one statement, on the pool so the anonymous snapshot path never
  // builds a PrismaClient. The sampled prune keeps the bucket table bounded to
  // the window without a cron: counted views are already rare (12h dedup).
  registerBackgroundWork(
    poolQuery(
      `WITH counted AS (
         UPDATE builds SET "viewCount" = "viewCount" + 1 WHERE id = $1
       )
       INSERT INTO build_view_days ("buildId", day, count)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT ("buildId", day)
         DO UPDATE SET count = build_view_days.count + 1`,
      [buildId],
    ),
    "view count",
  )
  sometimesInBackground(0.02, "view-day prune", () =>
    poolQuery(
      `DELETE FROM build_view_days WHERE day < CURRENT_DATE - INTERVAL '31 days'`,
    ),
  )
  setCookie(c, cookieName, "1", {
    path: "/",
    maxAge: VIEW_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: isHttps ? "None" : "Lax",
    secure: isHttps,
  })
}

/** The org a build may be published under: null for none, else one the user
 *  belongs to. Throws 400/403 otherwise. */
async function resolveOrgAssignment(
  raw: unknown,
  userId: string,
): Promise<string | null> {
  if (raw == null) return null
  if (typeof raw !== "string") throw httpError(400, "invalid_organization_id")
  if (!(await isOrgMember(raw, userId))) throw httpError(403, "not_org_member")
  return raw
}
