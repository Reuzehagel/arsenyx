"use client"

import { Eye, EyeOff, Lock, Loader2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"

import { getUserOrganizationsAction } from "@/app/actions/organizations"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OrganizationListItem } from "@/lib/db/organizations"
import { cn } from "@/lib/utils"

export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE"

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublish: (visibility: Visibility) => Promise<void>
  isPublishing: boolean
  isUpdate?: boolean
  organizationSlug?: string
  onOrganizationChange?: (slug: string | undefined) => void
  currentVisibility?: Visibility
}

export function PublishDialog({
  open,
  onOpenChange,
  onPublish,
  isPublishing,
  isUpdate = false,
  organizationSlug,
  onOrganizationChange,
  currentVisibility = "PUBLIC",
}: PublishDialogProps) {
  const [visibility, setVisibility] = useState<Visibility>(currentVisibility)
  const [orgs, setOrgs] = useState<OrganizationListItem[]>([])

  useEffect(() => {
    if (!open) return
    setVisibility(currentVisibility)
    getUserOrganizationsAction().then((result) => {
      if (result.success) setOrgs(result.data)
    })
  }, [open, currentVisibility])

  const handlePublish = async () => {
    await onPublish(visibility)
  }

  const publishAs = organizationSlug ?? "__personal"
  const privateDescription =
    publishAs === "__personal"
      ? "Only visible to you."
      : "Only visible to members of the selected organization."

  const publishAsItems = useMemo(
    () => [
      { value: "__personal", label: "Yourself" },
      ...orgs.map((org) => ({ value: org.slug, label: org.name })),
    ],
    [orgs],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? "Update Build" : "Publish Build"}
          </DialogTitle>
          <DialogDescription>Choose who can see your build.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {orgs.length > 0 && onOrganizationChange && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Publish as</p>
              <Select
                value={publishAs}
                onValueChange={(val: string | null) => {
                  onOrganizationChange(
                    val === "__personal" || !val ? undefined : val,
                  )
                }}
                items={publishAsItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Yourself" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value="__personal">Yourself</SelectItem>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.slug}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <VisibilityOption
            value="PUBLIC"
            current={visibility}
            onSelect={setVisibility}
            icon={Eye}
            title="Public"
            description="Visible to everyone and listed in search results."
          />
          <VisibilityOption
            value="UNLISTED"
            current={visibility}
            onSelect={setVisibility}
            icon={EyeOff}
            title="Unlisted"
            description="Only visible to people with the link."
          />
          <VisibilityOption
            value="PRIVATE"
            current={visibility}
            onSelect={setVisibility}
            icon={Lock}
            title="Private"
            description={privateDescription}
          />
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing}>
            {isPublishing && (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            )}
            {isUpdate ? "Update Build" : "Publish Build"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface VisibilityOptionProps {
  value: Visibility
  current: Visibility
  onSelect: (value: Visibility) => void
  icon: typeof Eye
  title: string
  description: string
}

function VisibilityOption({
  value,
  current,
  onSelect,
  icon: Icon,
  title,
  description,
}: VisibilityOptionProps) {
  const isSelected = value === current

  return (
    <div
      className={cn(
        "hover:bg-muted/50 flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors",
        isSelected && "border-primary bg-muted/30 ring-primary ring-1",
      )}
      onClick={() => onSelect(value)}
    >
      <div
        className={cn(
          "mt-0.5 rounded-full p-2",
          isSelected
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm leading-none font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  )
}
