import type { SavedBuildData } from "@arsenyx/shared/warframe/build-data"
import { clampVariantIndex } from "@arsenyx/shared/warframe/build-doc"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Link2, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { variantDisplayLabel } from "@/lib/build/variants"
import { getVariants } from "@/lib/codec/build-codec-adapter"
import { getImageUrl } from "@/lib/image-url"
import { buildQuery } from "@/lib/queries/build-query"
import {
  partnerBuildsQuery,
  useBuildSearch,
  useLinkPartner,
  useReorderPartners,
  useSetPartnerVariant,
  useUnlinkPartner,
  type PartnerBuild,
} from "@/lib/queries/partner-builds-query"

import { usePartnerReorder } from "./use-partner-reorder"

/** The guide editor's picker for linking, ordering and unlinking partner
 *  builds of a saved build. */
export function PartnerBuildsField({ buildSlug }: { buildSlug: string }) {
  const { data: partners = [] } = useQuery(partnerBuildsQuery(buildSlug))
  const link = useLinkPartner(buildSlug)
  const unlink = useUnlinkPartner(buildSlug)
  const reorder = useReorderPartners(buildSlug)
  const setVariant = useSetPartnerVariant(buildSlug)
  const { ghost, rowProps } = usePartnerReorder(partners, reorder.mutate)
  const canReorder = partners.length > 1
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
            <Link2 />
            Search builds to link…
          </span>
          <ChevronDown className="opacity-50" />
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
        <>
          {canReorder && (
            <p className="text-muted-foreground text-xs">
              Drag to reorder how they appear on the build.
            </p>
          )}
          <ul className="flex flex-wrap gap-2">
            {partners.map((p, i) => (
              <li key={p.id} {...(canReorder ? rowProps(i) : {})}>
                <PartnerChip
                  build={p}
                  onRemove={() => unlink.mutate(p.slug)}
                  onSetVariant={(variant) =>
                    setVariant.mutate({ partnerSlug: p.slug, variant })
                  }
                />
              </li>
            ))}
          </ul>
          {ghost}
        </>
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
  onSetVariant,
}: {
  build: PartnerBuild
  onRemove: () => void
  onSetVariant: (variant: number) => void
}) {
  return (
    <span className="bg-muted/40 inline-flex items-center gap-2 rounded-full border py-1 pr-1 pl-2 text-xs">
      <PartnerThumb build={build} />
      <span className="max-w-[14ch] truncate">{build.name}</span>
      <PartnerVariantPicker build={build} onSetVariant={onSetVariant} />
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

/**
 * Which variant of the partner build the related-builds chip should open
 * (issue #302). Renders nothing for single-variant partners — most builds —
 * so the chip stays clean. The variant list comes from the partner's own
 * detail payload (`?view=0`: browser-cacheable, no view-count bump); the
 * search endpoint deliberately doesn't carry variants.
 */
function PartnerVariantPicker({
  build,
  onSetVariant,
}: {
  build: PartnerBuild
  onSetVariant: (variant: number) => void
}) {
  const { data } = useQuery({
    ...buildQuery(build.slug, { countView: false }),
    staleTime: 60_000,
  })
  // Only the variant labels are read, so no catalog normalization is needed.
  const variants = data ? getVariants(data.buildData as SavedBuildData) : []
  if (variants.length < 2) return null

  // Clamp a stale stored target (the partner may have deleted variants since
  // this was saved) so the trigger never shows an empty label.
  const active = clampVariantIndex({ variants }, build.variant ?? 0)
  const label = (i: number) => variantDisplayLabel(variants[i], i)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title="Which variant the link opens"
            className="bg-muted text-muted-foreground hover:text-foreground inline-flex max-w-[12ch] items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors"
          />
        }
      >
        <span className="truncate">{label(active)}</span>
        <ChevronDown className="size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={String(active)}
          onValueChange={(v) => {
            const next = Number(v)
            if (next !== active) onSetVariant(next)
          }}
        >
          {variants.map((v, i) => (
            <DropdownMenuRadioItem key={v.id || i} value={String(i)}>
              {label(i)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
