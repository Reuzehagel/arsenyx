// Per-route <head> management. Routes pass the result of `seo()` to their
// `head` option; `<HeadContent />` in __root.tsx renders the tags. The
// canonical origin is fixed (www) so indexed URLs never split across the
// apex/www duplicate hosts — the Worker 301s apex → www to match.

import type { BuildVisibility } from "@arsenyx/shared/api/build-dto"
import {
  buildMetaDescription,
  buildMetaTitle,
  buildOgType,
  type BuildTitleInput,
} from "@arsenyx/shared/seo/build-meta"
import {
  absoluteImage,
  DEFAULT_DESCRIPTION,
  PAGE_META,
  pageTitle,
  SITE_NAME,
  SITE_URL,
  type PagePath,
} from "@arsenyx/shared/seo/site"

type AnyMeta = Record<string, string | undefined>

interface SeoOptions {
  /** Page title without the site suffix; `seo()` appends " — Arsenyx". */
  title?: string
  description?: string
  /** Site-relative canonical path incl. leading slash (e.g. "/browse").
   *  May include a query string for pages whose identity lives in search
   *  params (e.g. "/browse?category=melee"). Omit to skip the canonical. */
  canonicalPath?: string
  /** og:image: an absolute URL or a bare CDN filename; `seo()` absolutizes it
   *  against the image CDN, so callers may pass a raw `item.imageName`. */
  image?: string
  /** Auth/editor/user-private pages that should stay out of the index. */
  noindex?: boolean
  /** og:type. Defaults to "website". Must match what the edge Worker injects
   *  for the same URL (worker/index.ts buildMeta emits "article" for public
   *  build pages) — a mismatch leaves two conflicting og:type tags in the
   *  hydrated head, and og's "first tag wins" can pick the wrong one. */
  ogType?: string
  /** JSON-LD payload, rendered as <script type="application/ld+json">. */
  jsonLd?: object
}

export function seo(opts: SeoOptions = {}) {
  const title = pageTitle(opts.title)
  const description = opts.description ?? DEFAULT_DESCRIPTION
  const canonical = opts.canonicalPath
    ? `${SITE_URL}${opts.canonicalPath}`
    : undefined

  const meta: AnyMeta[] = [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: opts.ogType ?? "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ]
  if (canonical) meta.push({ property: "og:url", content: canonical })
  const image = absoluteImage(opts.image)
  if (image) {
    meta.push(
      { property: "og:image", content: image },
      { name: "twitter:image", content: image },
    )
  }
  if (opts.noindex) meta.push({ name: "robots", content: "noindex" })
  if (opts.jsonLd) meta.push({ "script:ld+json": opts.jsonLd } as never)

  return {
    meta,
    links: canonical ? [{ rel: "canonical", href: canonical }] : [],
  }
}

/** Head for a static page listed in PAGE_META (shared with the edge Worker
 *  and the sitemap): its title/description/noindex, self-canonical unless
 *  noindexed. */
export function pageSeo(path: PagePath) {
  const meta: { title?: string; description?: string; noindex?: boolean } =
    PAGE_META[path]
  return seo({
    title: meta.title,
    description: meta.description,
    noindex: meta.noindex,
    canonicalPath: meta.noindex ? undefined : path,
  })
}

/** Head for a build page (routes/_app/builds.$slug.tsx). Mirrors the Worker's
 *  buildMeta except og:description, which the edge enriches with live
 *  like/view stats for unfurls. Canonical/og:url/og:image only for PUBLIC
 *  builds, where the edge emits them too. */
export function buildPageSeo(
  build: BuildTitleInput &
    Parameters<typeof buildMetaDescription>[0] & {
      visibility: BuildVisibility
    },
  slug: string,
  ogImage: string | null,
) {
  const isPublic = build.visibility === "PUBLIC"
  return seo({
    title: buildMetaTitle(build),
    description: buildMetaDescription(build),
    canonicalPath: isPublic ? `/builds/${slug}` : undefined,
    image: isPublic ? (ogImage ?? undefined) : undefined,
    ogType: buildOgType(build.visibility),
    noindex: !isPublic,
  })
}
