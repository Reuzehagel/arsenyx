// Build-page SEO values shared by both head layers: the client route
// (apps/web/src/routes/_app/builds.$slug.tsx) and the edge Worker
// (apps/web/worker/index.ts). A JS-rendering crawler sees both, so they must
// agree. Dependency-free so the Worker bundles it cheaply.

import type { BuildVisibility } from "../api/build-dto"
import { clampCodePoints, collapseWhitespace } from "./site"

/** The author/org fields needed to credit a build. Both
 *  `BuildDetailResponse` and `BuildMetaResponse` satisfy this. */
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
 * Build-page title WITHOUT the " — Arsenyx" site suffix (both layers add it via
 * `pageTitle`). Whitespace is collapsed: author names can carry newlines.
 */
export function buildMetaTitle(b: BuildTitleInput): string {
  const author = buildAuthor(b)
  return collapseWhitespace(
    author ? `${b.item.name} Build by ${author}` : `${b.item.name} Build`,
  )
}

/** Build-page meta description. The Worker appends live like/view stats to
 *  og:description only; every other description tag is this exact string. */
export function buildMetaDescription(b: {
  name: string
  description: string | null
  item: { name: string }
  guide: { summary: string | null } | null
}): string {
  const summary = collapseWhitespace(b.guide?.summary ?? b.description ?? "")
  const lead = b.name === b.item.name ? "" : `${collapseWhitespace(b.name)}. `
  const body = summary || `${b.item.name} build with mods, arcanes, and stats.`
  return clampCodePoints(`${lead}${body}`, 280)
}

/**
 * og:type for a build page: "article" only when it is publicly indexable, else
 * "website". Must be identical across the two head layers — a mismatch leaves
 * two conflicting og:type tags in the hydrated head and og's "first tag wins"
 * can pick the wrong one.
 */
export function buildOgType(
  visibility: BuildVisibility,
): "article" | "website" {
  return visibility === "PUBLIC" ? "article" : "website"
}

/** og:image source for a build: the catalog's current image for its item (by
 *  the stable uniqueName), else the build's stored imageName, which rots across
 *  image-scheme changes. `imageMap` is CATALOG_FILES.imageMap; null while it's
 *  unavailable. */
export function resolveBuildImage(
  b: { item: { uniqueName: string; imageName: string | null } },
  imageMap: Record<string, string> | null | undefined,
): string | null {
  return imageMap?.[b.item.uniqueName] ?? b.item.imageName
}
