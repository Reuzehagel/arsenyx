import type { BuildVisibility } from "../generated/prisma/enums"

// Anonymous build-detail snapshots in Workers KV (binding BUILD_SNAPSHOTS).
//
// An edge-cache miss on GET /builds/:slug used to construct a PrismaClient and
// open a pg connection (~26-29 ms CPU locally) even though the anonymous answer
// only changes when the build is edited. The anonymous full payload (partner
// strip included) is stored here once per build, globally, and every anonymous
// miss in any colo is a KV get instead. Signed-in viewers stay on the live path.
//
// Writers: read-through on a missing key, and a write-through refresh on every
// mutation that changes what an anonymous viewer sees (builds.ts
// `invalidateBuilds`). A PRIVATE or deleted build is never stored: the refresh
// deletes its key, and the read path re-checks the visibility in the metadata.
//
// Staleness bound: SNAPSHOT_TTL. Counts (likeCount, viewCount, bookmarkCount,
// dislikeCount), author name/avatar and org name/logo are frozen until the next
// refresh, i.e. at most SNAPSHOT_TTL plus KV's ~60 s cross-colo read cache.
// That is also the bound for what no trigger refreshes: renames, org
// changes/deletion and direct DB scripts. Account deletion is covered
// (`userBuildSlugs` + `invalidateBuilds` in admin.ts and index.ts).
//
// It is long because every miss rebuilds through a PrismaClient, ~140 ms CPU
// in prod (Nov 2026 Workers Logs), and long-tail builds viewed less often than
// the TTL miss on every view. At 10 min, misses were ~80% of this route's CPU.
//
// The race refresh alone can't close (a read-through that loaded the row just
// before a mutation committed lands its put after the mutation's refresh; KV is
// last-writer-wins) is closed by invalidateBuilds refreshing a second time a
// few seconds later, so a PRIVATE flip can't be undone for a whole TTL.
export const SNAPSHOT_TTL = 24 * 60 * 60

export type SnapshotMeta = { id: string; visibility: BuildVisibility }
export type Snapshot = { body: Record<string, unknown>; meta: SnapshotMeta }

export const snapshotKey = (slug: string) => `build:${slug}`

export function isAnonVisible(visibility: string): boolean {
  return visibility === "PUBLIC" || visibility === "UNLISTED"
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

type Author = {
  id: string
  name: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
}

// The slim `?embed=1` payload the web Worker unfurls, derived from the full
// anonymous body so one key serves both. Field order and shape match the old
// dedicated query: the author is already redacted (visibleAuthor) in the
// snapshot, and a redacted author keeps its full HIDDEN_AUTHOR shape.
export function embedFromSnapshot(d: Record<string, any>) {
  const user = d.user as Author
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
