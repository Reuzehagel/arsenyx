import { Check, Globe, Link2, Lock, Users, type LucideIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"
import type { BuildDetail } from "@/lib/queries/build-query"
import type { OrgSummary } from "@/lib/queries/org-query"
import { cn } from "@/lib/util/utils"

export type PublishVisibility = BuildDetail["visibility"]

export type PublishDialogValues = {
  visibility: PublishVisibility
  organizationId: string | null
  hideAuthor: boolean
}

type PublishDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialVisibility: PublishVisibility
  initialOrganizationId: string | null
  initialHideAuthor: boolean
  owner: {
    name: string
    username: string | null
    image: string | null
  }
  organizations: OrgSummary[]
  confirmLabel?: string
  onConfirm: (values: PublishDialogValues) => void
}

const VISIBILITY_OPTIONS: {
  value: PublishVisibility
  label: string
  description: string
  Icon: LucideIcon
}[] = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Anyone can find and view this build in listings and search.",
    Icon: Globe,
  },
  {
    value: "UNLISTED",
    label: "Unlisted",
    description: "Only people with the link can view. Hidden from listings.",
    Icon: Link2,
  },
  {
    value: "PRIVATE",
    label: "Private",
    description: "Only you (and org members) can view this build.",
    Icon: Lock,
  },
]

export function PublishDialog({
  open,
  onOpenChange,
  initialVisibility,
  initialOrganizationId,
  initialHideAuthor,
  owner,
  organizations,
  confirmLabel = "Save build",
  onConfirm,
}: PublishDialogProps) {
  const [visibility, setVisibility] =
    useState<PublishVisibility>(initialVisibility)
  const [organizationId, setOrganizationId] = useState<string | null>(
    initialOrganizationId,
  )
  // UI state is the inverse of the persisted `hideAuthor` flag: the checkbox
  // reads "Show me as the author" so it stays an opt-in affirmation.
  const [showAuthor, setShowAuthor] = useState(!initialHideAuthor)

  // When the user picks a different org than the build's current one inside
  // an open dialog, treat it as a fresh attribution: default to showing the
  // author. Without this, an opt-out chosen for the previous org would bleed
  // into the new org silently. Restoring the initial org restores the
  // initial preference.
  useEffect(() => {
    setShowAuthor(
      organizationId === initialOrganizationId ? !initialHideAuthor : true,
    )
  }, [organizationId, initialOrganizationId, initialHideAuthor])

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setVisibility(initialVisibility)
      setOrganizationId(initialOrganizationId)
      setShowAuthor(!initialHideAuthor)
    }
    onOpenChange(o)
  }

  const ownerHandle = owner.username ? `@${owner.username}` : owner.name

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save build</DialogTitle>
          <DialogDescription>
            Choose who can see this build and where to publish it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Section label="Visibility">
            {VISIBILITY_OPTIONS.map(({ value, label, description, Icon }) => (
              <OptionCard
                key={value}
                selected={visibility === value}
                onSelect={() => setVisibility(value)}
                leading={
                  // Anchor the icon to the title's baseline so it stays
                  // aligned when the subtitle wraps to two lines on narrow
                  // viewports. The OptionCard wrapper centers single-line
                  // entries (avatars in "Publish as") via items-center.
                  <Icon className="mt-0.5 size-4 shrink-0 self-start" />
                }
                title={label}
                subtitle={description}
              />
            ))}
          </Section>

          <Section label="Publish as">
            <OptionCard
              selected={organizationId === null}
              onSelect={() => setOrganizationId(null)}
              leading={
                <UserAvatar src={owner.image} fallback={owner.name} size={7} />
              }
              title={owner.name}
              subtitle={`${ownerHandle} · Yourself`}
            />
            {organizations.length === 0 ? (
              <OptionCard
                disabled
                leading={
                  <div className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Users className="size-3.5" />
                  </div>
                }
                title="No organizations"
                subtitle="Join or create an org to publish on its behalf"
              />
            ) : (
              organizations.map((org) => (
                <OptionCard
                  key={org.id}
                  selected={organizationId === org.id}
                  onSelect={() => setOrganizationId(org.id)}
                  leading={
                    <UserAvatar src={org.image} fallback={org.name} size={7} />
                  }
                  title={org.name}
                  subtitle={`@${org.slug} · Organization`}
                />
              ))
            )}
            {organizationId !== null ? (
              <label className="hover:bg-muted/40 mt-1 flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-left">
                <Checkbox
                  checked={showAuthor}
                  onCheckedChange={(v) => setShowAuthor(v === true)}
                  className="mt-0.5 self-start"
                  aria-label="Show me as the author alongside the org"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm leading-none font-medium">
                    Show me as the author
                  </span>
                  <span className="text-muted-foreground text-xs leading-snug">
                    {showAuthor ? (
                      <>
                        Build will be credited to{" "}
                        <span className="text-foreground">{ownerHandle}</span>{" "}
                        alongside the org.
                      </>
                    ) : (
                      <>
                        Only the org will be shown. Your handle won't appear on
                        this build.
                      </>
                    )}
                  </span>
                </div>
              </label>
            ) : null}
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                visibility,
                organizationId,
                // hideAuthor only persists meaningfully on org builds; flatten
                // to false when no org is selected so we don't carry stale
                // state through the save.
                hideAuthor: organizationId !== null && !showAuthor,
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function OptionCard({
  selected = false,
  disabled = false,
  onSelect,
  leading,
  title,
  subtitle,
}: {
  selected?: boolean
  disabled?: boolean
  onSelect?: () => void
  leading: ReactNode
  title: string
  subtitle: string
}) {
  const className = cn(
    "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
    disabled
      ? "border-dashed opacity-60"
      : "hover:bg-muted/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
    selected && !disabled ? "border-primary bg-primary/5" : "border-border",
  )

  const content = (
    <>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-none font-medium">{title}</span>
        <span className="text-muted-foreground text-xs leading-snug">
          {subtitle}
        </span>
      </div>
      {selected && !disabled && (
        <Check className="text-primary size-4 shrink-0" />
      )}
    </>
  )

  if (disabled || !onSelect) {
    return (
      <div className={className} aria-disabled={disabled || undefined}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={className}
    >
      {content}
    </button>
  )
}
