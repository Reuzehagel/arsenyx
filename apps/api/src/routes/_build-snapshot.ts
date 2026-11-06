import type {
  BuildDetailResponse,
  BuildMetaResponse,
} from "@arsenyx/shared/api/build-dto"
import type { Context } from "hono"

import type { Bindings } from "../bindings"
import { prisma, registerBackgroundWork } from "../db"
import type { Prisma } from "../generated/prisma/client"
import type { BuildVisibility } from "../generated/prisma/enums"
import { purgeEdge } from "../lib/edge-cache"
import { DETAIL_MARKERS } from "../lib/measure"
import {
  ANON_VIEWER,
  DETAIL_INCLUDE,
  serializeBuildDetail,
} from "./_build-list"
import { partnerSelect, serializePartners } from "./_build-partners"
import { isAnonVisible } from "./_build-visibility"

// Anonymous build-detail snapshots in Workers KV (binding BUILD_SNAPSHOTS),
// and everything that keeps them — and the edge cache in front of them —
// fresh.
//
// An edge-cache miss on GET /builds/:slug used to construct a PrismaClient and
// open a pg connection (~26-29 ms CPU locally) even though the anonymous answer
// only changes when the build is edited. The anonymous full payload (partner
// strip included) is stored here once per build, globally, and every anonymous
// miss in any colo is a KV get instead. Signed-in viewers stay on the live path.
//
// Writers: read-through on a missing key (readAnonSnapshot), and a
// write-through refresh on every mutation that changes what an anonymous
// viewer sees (invalidateBuilds and the helpers below). A PRIVATE or deleted
// build is never stored: the refresh deletes its key, and the read path
// re-checks the visibility in the metadata.
//
// Staleness bound: SNAPSHOT_TTL. Counts (likeCount, viewCount, bookmarkCount,
// dislikeCount), author name/avatar and org name/logo are frozen until the next
// refresh, i.e. at most SNAPSHOT_TTL plus KV's ~60 s cross-colo read cache.
// That is also the bound for what no trigger refreshes: counts, direct DB
// scripts, and Better Auth refreshing name/avatar from GitHub on sign-in
// (overrideUserInfoOnSignIn, auth.ts). Account and org changes made through
// the API are covered (snapshotSlugs + invalidateBuilds in admin.ts, orgs.ts
// and index.ts).
//
// It is long because every miss rebuilds through a PrismaClient, ~140 ms CPU
// in prod (Nov 2026 Workers Logs), and long-tail builds viewed less often than
// the TTL miss on every view. At 10 min, misses were ~80% of this route's CPU.
export const SNAPSHOT_TTL = 24 * 60 * 60

export type SnapshotMeta = { id: string; visibility: BuildVisibility }
export type Snapshot = { body: BuildDetailResponse; meta: SnapshotMeta }

export const snapshotKey = (slug: string) => `build:${slug}`

const snapshotKv = (c: Context) => (c.env as Bindings).BUILD_SNAPSHOTS

// ---------------------------------------------------------------------------
// Detail variants
// ---------------------------------------------------------------------------

/** The three responses GET /builds/:slug serves, each its own edge-cache
 *  entry:
 *  - `full`: the page payload; counts a view.
 *  - `meta` (`?meta=1`): the slim unfurl payload the web Worker
 *    (apps/web/worker/index.ts) fetches for bot scrapes, cookieless. No view
 *    — every Discord unfurl would inflate viewCount, and the Set-Cookie would
 *    defeat the Worker's edge cache.
 *  - `noView` (`?view=0`): the embed viewer (apps/web/src/embed-main.tsx).
 *    Full body minus the partner strip; an impression on a third-party page
 *    is not a build view, and with no Set-Cookie it is browser-cacheable. */
const DETAIL_VARIANTS = {
  full: "",
  meta: "?meta=1",
  noView: "?view=0",
} as const

export type DetailVariant = keyof typeof DETAIL_VARIANTS

// `?embed=1` is what web Workers deployed before the `?meta=1` rename send;
// without it their unfurls would count views. Remove once both Workers deploy.
const LEGACY_META_QUERY = "?embed=1"

export function detailVariant(c: Context): DetailVariant {
  if (c.req.query("meta") === "1" || c.req.query("embed") === "1") return "meta"
  if (c.req.query("view") === "0") return "noView"
  return "full"
}

/** Every edge-cache URL of a build's detail. A purge that missed one would
 *  keep leaking a PRIVATE/deleted build through it until TTL expiry. */
export function detailCachePaths(slug: string): string[] {
  return [...Object.values(DETAIL_VARIANTS), LEGACY_META_QUERY].map(
    (q) => `/builds/${slug}${q}`,
  )
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

/** The anonymous GET /:slug body, partner strip included, in one query. null
 *  when the build is missing or not anonymously visible, so a PRIVATE build
 *  can never become a snapshot. */
async function loadAnonSnapshot(slug: string): Promise<Snapshot | null> {
  const build = await prisma.build.findUnique({
    where: { slug },
    relationLoadStrategy: "join",
    include: {
      ...DETAIL_INCLUDE,
      partnerBuilds: partnerSelect(undefined).partnerBuilds,
    },
  })
  if (!build || !isAnonVisible(build.visibility)) return null
  return {
    body: {
      ...serializeBuildDetail(build, ANON_VIEWER),
      partners: serializePartners(build),
    },
    meta: { id: build.id, visibility: build.visibility },
  }
}

// Put a fresh snapshot, or drop the key when the build is gone or not
// anonymously visible. The visibility check is repeated here so a caller can
// never store a PRIVATE build by passing the wrong row.
export async function writeSnapshot(
  kv: KVNamespace,
  slug: string,
  snap: Snapshot | null,
): Promise<void> {
  if (!snap || !isAnonVisible(snap.meta.visibility)) {
    await kv.delete(snapshotKey(slug))
    return
  }
  await kv.put(snapshotKey(slug), JSON.stringify(snap.body), {
    expirationTtl: SNAPSHOT_TTL,
    metadata: snap.meta,
  })
}

/** The anonymous detail as stored JSON text, from KV or (on a miss) Postgres
 *  with a background read-through write. null = not found for an anonymous
 *  viewer. */
export async function readAnonSnapshot(
  c: Context,
  slug: string,
): Promise<{ text: string; meta: SnapshotMeta } | null> {
  const kv = snapshotKv(c)
  // A failed KV read falls back to Postgres rather than 500ing the page.
  const hit = await kv
    .getWithMetadata<SnapshotMeta>(snapshotKey(slug), "text")
    .catch(() => null)
  // A key whose metadata isn't anonymously visible is treated as missing,
  // never served.
  if (
    hit?.value != null &&
    hit.metadata &&
    isAnonVisible(hit.metadata.visibility)
  ) {
    return { text: hit.value, meta: hit.metadata }
  }
  console.log(DETAIL_MARKERS.kvMiss)
  const snap = await loadAnonSnapshot(slug)
  // Only store real snapshots: a delete per 404/PRIVATE probe is a billed KV
  // write, and a stale key is already ignored by the check above.
  if (!snap) return null
  registerBackgroundWork(writeSnapshot(kv, slug, snap), "snapshot write")
  return { text: JSON.stringify(snap.body), meta: snap.meta }
}

type Author = BuildDetailResponse["user"]

// The slim `?meta=1` payload, derived from the full anonymous body so one key
// serves both. The author is already redacted (visibleAuthor) in the snapshot,
// and a redacted author keeps its full HIDDEN_AUTHOR shape.
export function metaFromSnapshot(d: BuildDetailResponse): BuildMetaResponse {
  const user: Author = d.user
  const hidden = d.hideAuthor && d.organization != null
  return {
    name: d.name,
    description: d.description,
    visibility: d.visibility,
    hideAuthor: d.hideAuthor,
    likeCount: d.likeCount,
    viewCount: d.viewCount,
    item: d.item,
    user: hidden
      ? user
      : {
          name: user.name,
          username: user.username,
          displayUsername: user.displayUsername,
        },
    organization: d.organization
      ? { name: d.organization.name, verified: d.organization.verified }
      : null,
    guide: d.guide ? { summary: d.guide.summary } : null,
  }
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

// A read-through that loaded the row just before a mutation committed can land
// its put after the mutation's refresh (KV is last-writer-wins), undoing e.g.
// a PRIVATE flip for a whole TTL. Refreshing a second time this much later
// overwrites it; the read-through's DB read finishes well inside the delay.
const RACE_REFRESH_MS = 5_000

function refreshWithRaceCover(kv: KVNamespace, slug: string) {
  const refresh = () =>
    loadAnonSnapshot(slug).then((snap) => writeSnapshot(kv, slug, snap))
  return refresh()
    .then(() => new Promise((r) => setTimeout(r, RACE_REFRESH_MS)))
    .then(refresh)
}

/** Every mutation that changes what an anonymous viewer of these builds sees:
 *  evicts the colo-local edge cache and rewrites (or drops) each KV snapshot
 *  after the response. Prefer the helpers below, which find the partners
 *  whose strips embed a build's card. */
export function invalidateBuilds(c: Context, slugs: string[]): void {
  const kv = snapshotKv(c)
  for (const slug of new Set(slugs)) {
    purgeEdge(c, detailCachePaths(slug))
    registerBackgroundWork(
      refreshWithRaceCover(kv, slug),
      `snapshot refresh ${slug}`,
    )
  }
}

/** Slugs whose anonymous snapshot shows a matching build: the builds plus
 *  every build whose partner strip lists one. Read BEFORE a delete (rows
 *  cascade away), then pass to invalidateBuilds after the write. */
export async function snapshotSlugs(
  where: Prisma.BuildWhereInput,
): Promise<string[]> {
  const rows = await prisma.build.findMany({
    where,
    select: { slug: true, partnerBuilds: { select: { slug: true } } },
  })
  return rows.flatMap((b) => [b.slug, ...b.partnerBuilds.map((p) => p.slug)])
}

/** After a write to one build's own card (name, visibility, thumbnail…):
 *  refreshes it and every partner strip that embeds it. */
export async function invalidateBuildAndPartners(
  c: Context,
  where: { id: string } | { slug: string },
): Promise<void> {
  invalidateBuilds(c, await snapshotSlugs(where))
}

/** Deletes one build and refreshes it (dropping its snapshot) and its
 *  partners' strips. False when there was no such build. */
export async function deleteBuild(
  c: Context,
  where: { id: string } | { slug: string },
): Promise<boolean> {
  const slugs = await snapshotSlugs(where)
  if (slugs.length === 0) return false
  await prisma.build.delete({ where })
  invalidateBuilds(c, slugs)
  return true
}

/** Deletes an Organization. Its builds survive, detached (organizationId →
 *  null), and `hideAuthor` goes with the org: a detached build has no org to
 *  hide behind, and a stale flag would keep it off its author's profile. Their
 *  snapshots embed the org, so they're refreshed. */
export async function deleteOrganization(
  c: Context,
  organizationId: string,
): Promise<void> {
  const slugs = await snapshotSlugs({ organizationId })
  await prisma.$transaction([
    prisma.build.updateMany({
      where: { organizationId },
      data: { organizationId: null, hideAuthor: false },
    }),
    prisma.organization.delete({ where: { id: organizationId } }),
  ])
  invalidateBuilds(c, slugs)
}
