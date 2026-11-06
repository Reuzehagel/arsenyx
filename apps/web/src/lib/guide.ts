import type { BuildDetailResponse } from "@arsenyx/shared/api/build-dto"
import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"

/**
 * Resolves the guide content GuideDisplay would render for a given view: a
 * per-variant guide (if the active variant has one) supersedes the build-wide
 * guide wholesale — we don't mix fields. Trimmed so whitespace-only guides
 * read as empty. Lives outside guide-display.tsx so the build viewer can
 * reserve layout space for the guide's lazy chunk without statically importing
 * react-markdown into the embed bundle.
 */
export function resolveGuide(
  build: Pick<BuildDetailResponse, "guide">,
  activeVariant: SavedVariant | undefined,
): { summary: string; description: string } {
  const variantSummary = activeVariant?.guideSummary?.trim()
  const variantDescription = activeVariant?.guideDescription?.trim()
  if (variantSummary || variantDescription) {
    return {
      summary: variantSummary ?? "",
      description: variantDescription ?? "",
    }
  }
  return {
    summary: build.guide?.summary?.trim() ?? "",
    description: build.guide?.description?.trim() ?? "",
  }
}

/** Whether {@link resolveGuide} yields any content for this view. */
export function hasGuideContent(
  build: Pick<BuildDetailResponse, "guide">,
  activeVariant: SavedVariant | undefined,
): boolean {
  const { summary, description } = resolveGuide(build, activeVariant)
  return Boolean(summary || description)
}
