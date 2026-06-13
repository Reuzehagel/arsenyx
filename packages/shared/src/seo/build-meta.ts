// Build-page SEO title / author / og:type derivation, shared by BOTH head
// layers: the web client (apps/web/src/routes/builds.$slug.tsx `head()` →
// seo()) and the edge Worker (apps/web/worker/index.ts `buildMeta`). A
// JS-rendering crawler sees both layers' tags for the same URL, so the values
// must agree. These were previously hand-duplicated in the two files and drifted
// — that's what produced the og:type "website" vs "article" mismatch. Deriving
// them once here makes drift impossible by construction. Pure and dependency-
// free so the Worker can bundle it without pulling in anything heavy.

/** The author/org fields needed to credit a build. Both the web
 *  `BuildDetailResponse` and the Worker's local `BuildSummary` satisfy this. */
export interface BuildAuthorInput {
  /** Org build → show the org, never the underlying user. */
  hideAuthor: boolean
  organization: { name: string } | null
  user: {
    displayUsername: string | null
    username: string | null
    name: string | null
  }
}

export interface BuildTitleInput extends BuildAuthorInput {
  item: { name: string }
}

/**
 * Author credit for a build's title/meta. `hideAuthor` (an org build) shows the
 * org name only — falling back to null rather than leaking the underlying user.
 * Otherwise prefer org → display username → username → name.
 */
export function buildAuthor(b: BuildAuthorInput): string | null {
  if (b.hideAuthor) return b.organization?.name ?? null
  return (
    b.organization?.name ??
    b.user.displayUsername ??
    b.user.username ??
    b.user.name
  )
}

/**
 * Build-page title WITHOUT the " — Arsenyx" site suffix. The web client appends
 * the suffix via seo(); the Worker appends " — <SITE_NAME>" itself. Both layers
 * then produce the identical final title.
 */
export function buildMetaTitle(b: BuildTitleInput): string {
  const author = buildAuthor(b)
  return author ? `${b.item.name} Build by ${author}` : `${b.item.name} Build`
}

/**
 * og:type for a build page: "article" only when it is publicly indexable, else
 * "website". Must be identical across the two head layers — a mismatch leaves
 * two conflicting og:type tags in the hydrated head and og's "first tag wins"
 * can pick the wrong one.
 */
export function buildOgType(
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED",
): "article" | "website" {
  return visibility === "PUBLIC" ? "article" : "website"
}
