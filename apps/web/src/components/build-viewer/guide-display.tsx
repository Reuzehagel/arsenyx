import { MarkdownBody } from "@/components/markdown-body"
import type { BuildDetail } from "@/lib/queries/build-query"
import type { SavedVariant } from "@/lib/queries/build-query"

/**
 * Renders the build guide below the loadout. Per-variant guide content
 * (if the active variant has any) replaces the build-wide guide
 * wholesale — we don't mix-and-match fields. Rationale: a per-variant
 * summary like "Use this for Steel Path" shouldn't get paired with the
 * build-wide long description that describes the default variant's
 * playstyle. Authors who want both showing should duplicate the
 * build-wide text into the variant guide.
 *
 * Returns null when there's no guide content for either source.
 */
export function GuideDisplay({
  build,
  activeVariant,
}: {
  build: Pick<BuildDetail, "guide">
  activeVariant: SavedVariant | undefined
}) {
  const variantSummary = activeVariant?.guideSummary?.trim()
  const variantDescription = activeVariant?.guideDescription?.trim()
  const hasVariantGuide = Boolean(variantSummary || variantDescription)
  const effectiveSummary = hasVariantGuide
    ? (variantSummary ?? "")
    : (build.guide?.summary ?? "")
  const effectiveDescription = hasVariantGuide
    ? (variantDescription ?? "")
    : (build.guide?.description ?? "")
  if (!effectiveSummary && !effectiveDescription) return null
  return (
    <div className="bg-card rounded-lg border p-4">
      {effectiveSummary ? (
        <p className="mb-3 font-medium">{effectiveSummary}</p>
      ) : null}
      {effectiveDescription ? (
        <MarkdownBody
          source={effectiveDescription}
          className="prose prose-sm dark:prose-invert max-w-none"
        />
      ) : null}
    </div>
  )
}
