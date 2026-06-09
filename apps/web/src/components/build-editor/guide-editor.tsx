import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Link2, TriangleAlert, X } from "lucide-react"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import {
  partnerBuildsQuery,
  useBuildSearch,
  useLinkPartner,
  useUnlinkPartner,
  type PartnerBuild,
} from "@/lib/queries/partner-builds-query"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

// CodeMirror lives behind this lazy boundary so it code-splits out of the main
// route chunk (and never reaches the read-only embed bundle).
const MarkdownEditor = lazy(() =>
  import("./markdown-editor/markdown-editor").then((m) => ({
    default: m.MarkdownEditor,
  })),
)

const SUMMARY_MAX = 160

export type GuideScope = { kind: "build" } | { kind: "variant"; index: number }

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
}: {
  summary: string
  onSummaryChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  /**
   * If provided, the editor renders the partner-builds picker bound to
   * this slug. Omitted for unsaved builds — partners can only be linked
   * after the build exists server-side.
   */
  buildSlug?: string
  /**
   * Variant scopes available for per-variant guides. When omitted (or
   * length <= 1), the chip row is hidden and the editor behaves as a
   * single build-wide guide editor.
   */
  scopes?: { id: string; label: string; hasContent: boolean }[]
  /**
   * Currently-edited scope. `build` edits the build-wide guide;
   * `variant` edits the per-variant guide at the given index.
   */
  activeScope?: GuideScope
  onScopeChange?: (scope: GuideScope) => void
  seedVariantFromBuild?: (index: number) => void
}) {
  const hasMultipleVariants =
    scopes !== undefined &&
    scopes.length > 1 &&
    activeScope !== undefined &&
    onScopeChange !== undefined
  // Auto-on if any variant already has guide content, or if we land on the
  // editor with a variant scope active — otherwise default to off so single-
  // guide authors don't see chips they don't need.
  const anyVariantHasContent = scopes?.some((s) => s.hasContent) ?? false
  const [perVariantEnabled, setPerVariantEnabled] = useState<boolean>(
    () => anyVariantHasContent || activeScope?.kind === "variant",
  )
  // Remember the last variant index the user was editing so toggling the
  // switch off and on returns to it (instead of always snapping to 0).
  const [lastVariantIndex, setLastVariantIndex] = useState<number>(() =>
    activeScope?.kind === "variant" ? activeScope.index : 0,
  )
  useEffect(() => {
    if (activeScope?.kind === "variant") setLastVariantIndex(activeScope.index)
  }, [activeScope])
  const showScopeChips = hasMultipleVariants && perVariantEnabled

  // Initial auto-on path: if the editor mounts with per-variant enabled but
  // the active scope still says `build`, route to the first variant so a
  // chip is selected. Without this the chip row renders with nothing active.
  useEffect(() => {
    if (
      perVariantEnabled &&
      hasMultipleVariants &&
      activeScope?.kind === "build" &&
      scopes &&
      scopes.length > 0
    ) {
      const idx = Math.min(lastVariantIndex, scopes.length - 1)
      onScopeChange?.({ kind: "variant", index: Math.max(0, idx) })
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
                seedVariantFromBuild?.(idx)
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
              <div
                role="tablist"
                aria-label="Guide scope"
                className="flex flex-wrap items-center gap-1.5"
              >
                {scopes.map((s, i) => (
                  <ScopeChip
                    key={s.id || i}
                    label={s.label || `Variant ${i + 1}`}
                    active={
                      activeScope.kind === "variant" && activeScope.index === i
                    }
                    hasContent={s.hasContent}
                    onClick={() => onScopeChange({ kind: "variant", index: i })}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="guide-summary">Summary</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {summary.length}/{SUMMARY_MAX}
          </span>
        </div>
        <Input
          id="guide-summary"
          placeholder="One-line pitch — what makes this build tick?"
          value={summary}
          maxLength={SUMMARY_MAX}
          onChange={(e) => onSummaryChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Description</Label>
        <Suspense fallback={<MarkdownEditorSkeleton />}>
          <MarkdownEditor
            value={description}
            onChange={onDescriptionChange}
            docKey={
              activeScope?.kind === "variant"
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
              <Link2 className="size-4" />
              Save the build to link partners…
            </span>
            <ChevronDown className="size-4 opacity-50" />
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
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent",
      )}
    >
      <span>{label}</span>
      {hasContent ? (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            active ? "bg-primary-foreground/80" : "bg-emerald-500",
          )}
        />
      ) : null}
    </button>
  )
}

function PartnerBuildsField({ buildSlug }: { buildSlug: string }) {
  const { data: partners = [] } = useQuery(partnerBuildsQuery(buildSlug))
  const link = useLinkPartner(buildSlug)
  const unlink = useUnlinkPartner(buildSlug)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const search = useBuildSearch(q)

  const linkedSlugs = new Set(partners.map((p) => p.slug))
  const candidates = (search.data ?? []).filter(
    (b) => b.slug !== buildSlug && !linkedSlugs.has(b.slug),
  )

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-between font-normal"
            />
          }
        >
          <span className="inline-flex items-center gap-2">
            <Link2 className="size-4" />
            Search builds to link…
          </span>
          <ChevronDown className="size-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type a build or item name…"
              value={q}
              onValueChange={setQ}
            />
            <CommandList>
              {q.trim().length < 2 ? (
                <CommandEmpty>Type at least 2 characters.</CommandEmpty>
              ) : search.isLoading ? (
                <CommandEmpty>Searching…</CommandEmpty>
              ) : candidates.length === 0 ? (
                <CommandEmpty>No matches.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {candidates.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={b.id}
                      onSelect={() => {
                        link.mutate(b)
                        setOpen(false)
                        setQ("")
                      }}
                    >
                      <PartnerThumb build={b} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{b.name}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {b.item.name}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {partners.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {partners.map((p) => (
            <li key={p.id}>
              <PartnerChip build={p} onRemove={() => unlink.mutate(p.slug)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PartnerThumb({ build }: { build: PartnerBuild }) {
  const src = build.item.imageName ? getImageUrl(build.item.imageName) : null
  return (
    <div className="bg-muted flex size-6 shrink-0 items-center justify-center overflow-hidden rounded">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Link2 className="text-muted-foreground size-4" />
      )}
    </div>
  )
}

function PartnerChip({
  build,
  onRemove,
}: {
  build: PartnerBuild
  onRemove: () => void
}) {
  return (
    <span className="bg-muted/40 inline-flex items-center gap-2 rounded-full border py-1 pr-1 pl-2 text-xs">
      <PartnerThumb build={build} />
      <span className="max-w-[14ch] truncate">{build.name}</span>
      <button
        type="button"
        aria-label={`Unlink ${build.name}`}
        onClick={onRemove}
        className="hover:bg-accent text-muted-foreground hover:text-accent-foreground flex size-5 items-center justify-center rounded-full"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function MarkdownEditorSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="border-input bg-muted/30 h-10 rounded-lg border" />
      <div className="border-input bg-muted/10 min-h-64 rounded-lg border" />
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
    <div className="text-foreground/90 mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <p>
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
      </p>
    </div>
  )
}
