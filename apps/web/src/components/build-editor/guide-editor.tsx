import { GUIDE_SUMMARY_EDITOR_MAX } from "@arsenyx/shared/api/limits"
import { ChevronDown, Link2, TriangleAlert } from "lucide-react"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"

import {
  VARIANT_TRACK,
  VariantTab,
} from "@/components/build-loadout/variant-tab"
import { PartnerBuildsField } from "@/components/partner-builds/partner-builds-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { variantDisplayLabel } from "@/lib/build/variants"

import type { GuideEditorProps } from "./use-guide-state"

// CodeMirror lives behind this lazy boundary so it code-splits out of the main
// route chunk (and never reaches the read-only embed bundle).
const MarkdownEditor = lazy(() =>
  import("./markdown-editor/markdown-editor").then((m) => ({
    default: m.MarkdownEditor,
  })),
)

export function GuideEditor({
  summary,
  onSummaryChange,
  description,
  onDescriptionChange,
  buildSlug,
  scopes,
  activeScope,
  onScopeChange,
  seedVariantFromBuild,
  formNames,
}: GuideEditorProps & {
  /** Binds the partner-builds picker. Unsaved builds can't link partners. */
  buildSlug?: string
  /** Twin-frames: per-variant chips are grouped under their form so
   *  identically-labeled variants across forms stay distinguishable. */
  formNames?: string[]
}) {
  const hasMultipleVariants = scopes.length > 1
  // Auto-on if any variant already has guide content, or if we land on the
  // editor with a variant scope active — otherwise default to off so single-
  // guide authors don't see chips they don't need.
  const anyVariantHasContent = scopes.some((s) => s.hasContent)
  const [perVariantEnabled, setPerVariantEnabled] = useState<boolean>(
    () => anyVariantHasContent || activeScope.kind === "variant",
  )
  // Remember the last variant index the user was editing so toggling the
  // switch off and on returns to it (instead of always snapping to 0).
  const [lastVariantIndex, setLastVariantIndex] = useState<number>(() =>
    activeScope.kind === "variant" ? activeScope.index : 0,
  )
  useEffect(() => {
    if (activeScope.kind === "variant") setLastVariantIndex(activeScope.index)
  }, [activeScope])
  const showScopeChips = hasMultipleVariants && perVariantEnabled

  // Initial auto-on path: if the editor mounts with per-variant enabled but
  // the active scope still says `build`, route to the first variant so a
  // chip is selected. Without this the chip row renders with nothing active.
  useEffect(() => {
    if (
      perVariantEnabled &&
      hasMultipleVariants &&
      activeScope.kind === "build"
    ) {
      const idx = Math.min(lastVariantIndex, scopes.length - 1)
      onScopeChange({ kind: "variant", index: Math.max(0, idx) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">
          Build Guide{" "}
          <span className="text-muted-foreground text-sm font-normal">
            (optional)
          </span>
        </h2>
        <p className="text-muted-foreground text-sm">
          A short summary and a markdown write-up about your build.
        </p>
      </div>

      {hasMultipleVariants ? (
        <div className="bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
          <label className="flex items-center gap-3">
            <Switch
              checked={perVariantEnabled}
              onCheckedChange={(checked) => {
                setPerVariantEnabled(checked)
                if (!checked) {
                  onScopeChange({ kind: "build" })
                  return
                }
                const idx = Math.max(
                  0,
                  Math.min(lastVariantIndex, scopes.length - 1),
                )
                // Seed the landing variant from the build-wide guide so the
                // text the user was just looking at doesn't appear to vanish.
                seedVariantFromBuild(idx)
                onScopeChange({ kind: "variant", index: idx })
              }}
            />
            <span className="text-sm font-medium">
              Write a separate guide per variant
            </span>
          </label>
          {showScopeChips ? (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-muted-foreground text-xs">
                Editing guide for:
              </span>
              {(() => {
                // One labeled row per form for twin-frames (so identically-
                // named variants across forms — two "Variant 2" — are
                // distinguishable), else a single unlabeled row. The non-twin
                // case is just the one-group degenerate of the grouped render.
                const twin = formNames && formNames.length > 1
                const rows = twin
                  ? formNames.map((fname, fi) => ({
                      key: String(fi),
                      label: fname,
                      ariaLabel: `${fname} guide scope`,
                      items: scopes
                        .map((s, i) => ({ s, i }))
                        .filter(({ s }) => (s.formIndex ?? 0) === fi),
                    }))
                  : [
                      {
                        key: "all",
                        label: undefined,
                        ariaLabel: "Guide scope",
                        items: scopes.map((s, i) => ({ s, i })),
                      },
                    ]
                return (
                  <div className="flex flex-col gap-2">
                    {rows.map((row) =>
                      row.items.length === 0 ? null : (
                        <div
                          key={row.key}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          {row.label !== undefined && (
                            <span className="text-muted-foreground w-12 shrink-0 text-xs font-medium">
                              {row.label}
                            </span>
                          )}
                          <div
                            role="tablist"
                            aria-label={row.ariaLabel}
                            className={VARIANT_TRACK}
                          >
                            {row.items.map(({ s, i }) => (
                              <ScopeChip
                                key={s.id || i}
                                label={variantDisplayLabel(s, i)}
                                active={
                                  activeScope.kind === "variant" &&
                                  activeScope.index === i
                                }
                                hasContent={s.hasContent}
                                onClick={() =>
                                  onScopeChange({ kind: "variant", index: i })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )
              })()}
            </div>
          ) : null}
        </div>
      ) : null}

      <Field>
        <FieldLabel htmlFor="guide-summary">Summary</FieldLabel>
        <Input
          id="guide-summary"
          placeholder="One-line pitch — what makes this build tick?"
          value={summary}
          maxLength={GUIDE_SUMMARY_EDITOR_MAX}
          onChange={(e) => onSummaryChange(e.target.value)}
        />
        <FieldDescription className="tabular-nums">
          {summary.length}/{GUIDE_SUMMARY_EDITOR_MAX}
        </FieldDescription>
      </Field>

      <div className="flex flex-col gap-2">
        <Label>Description</Label>
        <Suspense fallback={<MarkdownEditorSkeleton />}>
          <MarkdownEditor
            value={description}
            onChange={onDescriptionChange}
            docKey={
              activeScope.kind === "variant"
                ? `variant-${activeScope.index}`
                : "build"
            }
          />
        </Suspense>
        <DiscordImageWarning source={description} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Partner builds</Label>
        <p className="text-muted-foreground text-xs">
          Link related builds — exalted weapons, companion loadouts, alt
          variants. Linked builds show up on both sides.
        </p>
        {buildSlug ? (
          <PartnerBuildsField buildSlug={buildSlug} />
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="h-9 w-full justify-between font-normal"
          >
            <span className="inline-flex items-center gap-2">
              <Link2 />
              Save the build to link partners…
            </span>
            <ChevronDown className="opacity-50" />
          </Button>
        )}
      </div>
    </div>
  )
}

function ScopeChip({
  label,
  active,
  hasContent,
  onClick,
}: {
  label: string
  active: boolean
  hasContent: boolean
  onClick: () => void
}) {
  return (
    <VariantTab active={active} onClick={onClick} className="px-2.5 text-xs">
      <span>{label}</span>
      {hasContent ? (
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
      ) : null}
    </VariantTab>
  )
}

function MarkdownEditorSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="border-input h-10 rounded-lg border" />
      <Skeleton className="border-input min-h-64 rounded-lg border" />
    </div>
  )
}

function DiscordImageWarning({ source }: { source: string }) {
  const hasDiscordUrl = useMemo(() => {
    return /https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net|discord\.com\/channels)\/\S+/i.test(
      source,
    )
  }, [source])
  if (!hasDiscordUrl) return null
  return (
    <Alert className="border-warning/30 bg-warning/10 text-warning mt-2 px-3 py-2 text-xs">
      <TriangleAlert />
      <AlertDescription className="text-foreground/90 text-xs">
        Discord image links expire and will eventually 404 for other viewers.
        Re-upload images to{" "}
        <a
          href="https://imgur.com/upload"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Imgur
        </a>{" "}
        or another permanent host instead.
      </AlertDescription>
    </Alert>
  )
}
