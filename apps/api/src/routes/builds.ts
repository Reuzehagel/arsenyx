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
import { marker, profile } from "../lib/phase-timing"
import { getSession } from "../lib/session"
import { hasPrismaCode, parseJsonBody, trimToMax } from "../lib/validate"
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
  describeEdit,
  MAX_REVISION_NOTE,
  pruneRevisions,
  readRevisions,
} from "./_build-revisions"
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

// Edge-cache TTLs for the anonymous public reads (see lib/edge-cache.ts).
//
// These were 10s, which at current traffic meant a near-zero hit rate: ~0.4
// req/s spread across colos is roughly one request per colo per 50s, so a 10s
// window almost never caught a second hit. Every miss reaches a handler that
// touches `prisma.*`, and that constructs a fresh PrismaClient — instantiating
// the 3.6 MB WASM query compiler — per request (see db.ts). Cache hits return
// before any of that, so TTL is the main lever on API CPU.
//
// DETAIL is the safe one to raise: purgeEdge() evicts all three of its variants
// on write, and authenticated editors bypass the cache entirely, so owners
// always see their own writes. The residual staleness is that purges are
// colo-local — other colos serve stale for up to the TTL.
//
// Second, less obvious cost: a cache HIT never runs the handler, so it never
// runs maybeIncrementView. Raising this therefore undercounts views by roughly
// the hit rate. Judged acceptable because views are already deduped per browser
// via the `vw_<slug>` cookie, so the metric was never a raw impression count —
// but if viewCount fidelity ever matters more than CPU, this is the dial.
const DETAIL_TTL = 120

// For the list-shaped responses — GET /builds and GET /:slug/partners, both
// projected through LIST_SELECT. The binding constraint is that NEITHER is
// purged on write: their keys include every filter/sort/page combination and the
// Cache API has no wildcard delete, so a PUBLIC->PRIVATE flip or a delete can
// linger for the whole TTL with no way to evict it early. That is why this stays
// well under DETAIL_TTL — for these routes the TTL is the *only* bound on
// staleness, whereas detail also has purgeEdge.
const LIST_TTL = 30

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
          // Anchor entry for the edit log. Written here rather than backfilled
          // so every build created from now on has a real "created by" row —
          // Build.createdAt says when, but only this says who, which for an org
          // build is not the same question.
          revisions: {
            create: {
              editorId: session.user.id,
              kind: "CREATED",
              note: trimToMax(b.revisionNote, MAX_REVISION_NOTE),
            },
          },
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
      // For the revision below: the editor sends `guide` on every save whether
      // or not it changed, so "was the guide edited" has to be answered by
      // comparing content, not by the field's presence.
      buildGuide: { select: { summary: true, description: true } },
    },
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

  // Every accepted PATCH writes one revision, in the same statement as the
  // update so a save can never land without its log entry. Bursts of saves from
  // one editing session are folded at READ time (see the revisions route) —
  // folding on write would need the pre-burst document, which isn't stored.
  const changes = describeEdit(existing, data, guide)
  data.revisions = {
    create: {
      editorId: session.user.id,
      kind: "EDITED",
      note: trimToMax(b.revisionNote, MAX_REVISION_NOTE),
      changes: changes as unknown as InputJsonValue,
    },
  }

  const updated = await prisma.build.update({
    where: { id: existing.id },
    data,
    select: { id: true, slug: true },
  })
  pruneRevisions(existing.id)
  purgeEdge(c, `/builds/${slug}`)
  return c.json(updated)
})

builds.get("/:slug/revisions", async (c) => {
  const slug = c.req.param("slug")

  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const build = await prisma.build.findUnique({
    where: { slug },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!build) return c.json({ error: "not_found" }, 404)
  // Same gate as editing: if you can change the build you can see who else
  // has. This deliberately reuses canMutateBuild rather than checking org
  // membership directly, so it covers solo builds (author sees their own log)
  // without inventing a second permission rule.
  if (!(await canMutateBuild(build, session.user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  return c.json(await readRevisions(build.id))
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

builds.get("/", edgeCache({ maxAge: LIST_TTL }), async (c) => {
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
    const blocked = await enforceAnonSearchLimit(c, "/builds/search")
    if (blocked) return blocked

    const limitRaw = parseInt(c.req.query("limit") ?? "", 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, SEARCH_MAX_LIMIT)
        : SEARCH_DEFAULT_LIMIT

    // `mine=1` narrows to builds the requester holds mutate rights on (own +
    // org). The partner picker uses this: linking requires mutual ownership
    // (see PUT /:slug/partners/:partnerSlug), so surfacing other people's
    // builds there only sets up a guaranteed 403.
    let scope: Prisma.BuildWhereInput
    if (c.req.query("mine") === "1") {
      if (!viewerId) return c.json({ error: "unauthorized" }, 401)
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: viewerId },
        select: { organizationId: true },
      })
      scope = {
        OR: [
          { userId: viewerId },
          ...(memberships.length > 0
            ? [
                {
                  organizationId: {
                    in: memberships.map((m) => m.organizationId),
                  },
                },
              ]
            : []),
        ],
      }
    } else {
      // PUBLIC only — UNLISTED is "accessible by URL, not enumerable", and a
      // typeahead is enumeration. Viewers can additionally find their own
      // builds regardless of visibility.
      scope = viewerId
        ? {
            OR: [{ visibility: BuildVisibility.PUBLIC }, { userId: viewerId }],
          }
        : { visibility: BuildVisibility.PUBLIC }
    }

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
    return c.json({ builds: rows.map(serializeListRow) })
  },
)

async function loadPartnerContext(slug: string, partnerSlug: string) {
  const [own, partner] = await Promise.all([
    prisma.build.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        partnerVariants: true,
      },
    }),
    prisma.build.findUnique({
      where: { slug: partnerSlug },
      select: {
        id: true,
        userId: true,
        visibility: true,
        organizationId: true,
        partnerVariants: true,
      },
    }),
  ])
  return { own, partner }
}

// Coerce the `partnerVariants` JSON column into a clean id -> variant-index
// map. Defensive by design: anything that isn't a positive integer below
// MAX_VARIANTS is treated as unset (0 / absent both mean "default variant",
// so 0 is never stored). Also the single point where stale garbage in the
// column gets dropped on rewrite.
function asVariantMap(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [id, v] of Object.entries(value)) {
    if (
      typeof v === "number" &&
      Number.isInteger(v) &&
      v > 0 &&
      v < MAX_VARIANTS
    ) {
      out[id] = v
    }
  }
  return out
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
//
// TEMPORARY: profile() is here to attribute ~1s of CPU seen on this route in
// Workers Logs (two requests, same colo, 3 minutes apart, wallTime − cpuTime
// only ~120–200ms — so pure execution, not the DB). Remove once answered; see
// lib/phase-timing.ts for why the durations only mean anything locally.
builds.get(
  "/:slug/partners",
  // Before edgeCache, so the session resolve edgeCache does lands inside the
  // measured window — it's one of the two suspects.
  profile("builds/:slug/partners"),
  edgeCache({ maxAge: LIST_TTL }),
  async (c) => {
    const mark = marker(c)
    // Everything upstream of the handler: edgeCache's isAuthenticated() →
    // getSession(), plus the Cache API lookup.
    mark("gate")

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
      : {
          visibility: {
            in: [BuildVisibility.PUBLIC, BuildVisibility.UNLISTED],
          },
        }

    // Reading a property off the `prisma` Proxy runs its get-trap, which
    // constructs this request's PrismaClient — and with it the wasm-compiler-edge
    // query compiler — WITHOUT issuing a query (see db.ts). That splits client
    // construction from query execution, which is the whole question: one is a
    // fixed per-request cost, the other scales with the data (and the data here
    // is 5 rows / ~4 KB, far too little to explain a second).
    //
    // `void` rather than an assigned-and-unused const purely to keep oxlint
    // quiet. esbuild preserves property accesses rather than treating them as
    // pure (they may run a getter — here one definitely does), so the bundler
    // won't optimize this away and silently fold init back into `query`.
    void prisma.$connect
    mark("prismaInit")

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
        partnerOrder: true,
        partnerVariants: true,
        partnerBuilds: {
          where: partnerVisibility,
          take: 50,
          select: LIST_SELECT,
        },
      },
    })
    mark("query")
    if (!build) return c.json({ error: "not_found" }, 404)
    if (!(await canViewerSeeBuild(build, viewerId ?? ""))) {
      return c.json({ error: "not_found" }, 404)
    }

    // The owner's saved variant target rides along on each row (`variant`
    // omitted = default). The web chip turns it into `?v=` on the link; an
    // index that outgrew the partner's variant list is clamped by the viewer.
    const variantMap = asVariantMap(build.partnerVariants)
    const body = {
      builds: orderPartners(build.partnerBuilds, build.partnerOrder).map(
        (p) => {
          const row = serializeListRow(p)
          const variant = variantMap[p.id]
          return variant ? { ...row, variant } : row
        },
      ),
    }
    mark("serialize")
    return c.json(body)
  },
)

// Sort partner rows by the owner's saved order. Ids listed in `order` come
// first in that order; anything not listed (newly linked, or never reordered)
// keeps its original relative position at the end. Stale ids in `order` that
// no longer resolve to a visible partner are simply skipped.
function orderPartners<T extends { id: string }>(
  rows: T[],
  order: string[],
): T[] {
  if (order.length === 0) return rows
  const rank = new Map(order.map((id, i) => [id, i]))
  const fallback = order.length
  // Array.sort is stable, so rows that tie on rank (all the unlisted ones share
  // `fallback`) keep their original relative order for free.
  return rows
    .slice()
    .sort((a, b) => (rank.get(a.id) ?? fallback) - (rank.get(b.id) ?? fallback))
}

// Persist the owner's display order for its partner strip. One-sided: only
// the owning build's `partnerOrder` is written (the partner side keeps its
// own order), so this needs mutate rights on `own` alone — unlike link/unlink,
// which mutate both builds and require mutual ownership. The body is a list of
// partner build ids; we store it verbatim after intersecting with the current
// links so a stale/foreign id can't be smuggled in.
//
// MUST stay registered before "/:slug/partners/:partnerSlug": Hono matches
// routes in registration order, so the param route would otherwise capture
// `order` as a partnerSlug and this handler would be unreachable.
builds.put("/:slug/partners/order", rateLimitUser("mutate"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const viewerId = session.user.id

  const slug = c.req.param("slug")
  const parsed = await parseJsonBody(c, { maxBytes: 8 * 1024 })
  if (!parsed.ok) return parsed.response
  const order = parsed.value.order
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
  if (!(await canMutateBuild(own, viewerId))) {
    return c.json({ error: "forbidden" }, 403)
  }

  // Keep only ids that are actually linked, in the requested order; drop
  // unknowns, then dedup (Set preserves insertion order). Partners omitted from
  // the request keep appending after these (the read-side `orderPartners`
  // fallback handles that).
  const linked = new Set(own.partnerBuilds.map((p) => p.id))
  const nextOrder = [
    ...new Set((order as string[]).filter((id) => linked.has(id))),
  ]

  await prisma.build.update({
    where: { id: own.id },
    data: { partnerOrder: nextOrder },
  })
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
    const session = await getSession(c)
    if (!session?.user) return c.json({ error: "unauthorized" }, 401)
    const viewerId = session.user.id

    const parsed = await parseJsonBody(c, { maxBytes: 1024 })
    if (!parsed.ok) return parsed.response
    const raw = parsed.value.variant
    const valid =
      raw === null ||
      (typeof raw === "number" &&
        Number.isInteger(raw) &&
        raw >= 0 &&
        raw < MAX_VARIANTS)
    if (!valid) return c.json({ error: "invalid_variant" }, 400)
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
    if (!(await canMutateBuild(own, viewerId))) {
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
    return c.body(null, 204)
  },
)

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

builds.get("/:slug", edgeCache({ maxAge: DETAIL_TTL }), async (c) => {
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
        organization: { select: { name: true, verified: true } },
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
