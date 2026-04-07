"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  getUserOrganizationsAction,
  createOrganizationAction,
} from "@/app/actions/organizations"
import {
  getSettingsDataAction,
  updateProfileAction,
} from "@/app/actions/profile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { OrganizationListItem } from "@/lib/db/organizations"

import { ApiKeysSection } from "./api-keys-section"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UserData {
  username: string
  displayUsername: string | null
  image: string | null
  bio: string | null
  email: string
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [orgs, setOrgs] = useState<OrganizationListItem[]>([])
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [newOrgSlug, setNewOrgSlug] = useState("")
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  const [canCreateOrg, setCanCreateOrg] = useState(false)

  // Fetch user data when sheet opens
  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    setError(null)
    getSettingsDataAction().then((result) => {
      if (result.success) {
        const user = result.data
        setUserData({
          username: user.username ?? "",
          displayUsername: user.displayUsername,
          image: user.image,
          bio: user.bio,
          email: user.email,
        })
        setUsername(user.displayUsername ?? user.username ?? "")
        setBio(user.bio ?? "")
        setCanCreateOrg(
          user.isCommunityLeader === true || user.isAdmin === true,
        )
      }
      setIsLoading(false)
    })
    getUserOrganizationsAction().then((result) => {
      if (result.success) setOrgs(result.data)
    })
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await updateProfileAction({
      username: username.trim(),
      bio: bio.trim(),
    })

    setIsPending(false)

    if (result.success) {
      toast.success("Profile updated")
      onOpenChange(false)
    } else {
      setError(result.error)
      toast.error(result.error)
    }
  }

  async function handleCreateOrg() {
    if (!newOrgName.trim()) return
    setIsCreatingOrg(true)
    const result = await createOrganizationAction({
      name: newOrgName.trim(),
      slug: newOrgSlug.trim(),
    })
    setIsCreatingOrg(false)
    if (result.success) {
      toast.success("Organization created")
      setOrgs((prev) => [
        ...prev,
        {
          id: result.data.id,
          name: result.data.name,
          slug: result.data.slug,
          image: result.data.image,
          role: "ADMIN",
        },
      ])
      setShowCreateOrg(false)
      setNewOrgName("")
      setNewOrgSlug("")
    } else {
      toast.error(result.error)
    }
  }

  const usernameError = error?.toLowerCase().includes("username") ? error : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-hidden sm:max-w-md">
        <SheetHeader className="shrink-0">
          <SheetTitle>Profile Settings</SheetTitle>
          <SheetDescription>
            Update your public profile information
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-3">
          {isLoading || !userData ? (
            <div className="flex flex-col gap-5">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <form id="settings-form" onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Avatar</FieldLabel>
                    <div className="flex items-center gap-4">
                      <Avatar className="size-14">
                        <AvatarImage
                          src={userData.image ?? undefined}
                          alt={userData.username ?? "Avatar"}
                        />
                        <AvatarFallback>
                          {(userData.displayUsername ??
                            userData.username ??
                            "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <FieldDescription>
                        Synced from your GitHub account
                      </FieldDescription>
                    </div>
                  </Field>

                  <Field data-invalid={usernameError ? true : undefined}>
                    <FieldLabel htmlFor="settings-username">
                      Username
                    </FieldLabel>
                    <Input
                      id="settings-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your-username…"
                      autoComplete="username"
                      spellCheck={false}
                      minLength={3}
                      maxLength={20}
                      aria-invalid={usernameError ? true : undefined}
                    />
                    <FieldDescription>
                      3-20 characters. Letters, numbers, hyphens, and
                      underscores only.
                    </FieldDescription>
                    {usernameError && <FieldError>{usernameError}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="settings-bio">Bio</FieldLabel>
                    <Textarea
                      id="settings-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell others about yourself…"
                      maxLength={300}
                      rows={3}
                    />
                    <FieldDescription>{bio.length}/300</FieldDescription>
                  </Field>

                  <Field data-disabled>
                    <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                    <Input
                      id="settings-email"
                      value={userData.email}
                      disabled
                    />
                    <FieldDescription>
                      Managed by your GitHub account
                    </FieldDescription>
                  </Field>
                </FieldGroup>

                {/* Organizations section */}
                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Organizations</span>
                    {canCreateOrg && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreateOrg((v) => !v)}
                      >
                        {showCreateOrg ? "Cancel" : "Create Organization"}
                      </Button>
                    )}
                  </div>

                  {orgs.length === 0 && !showCreateOrg && (
                    <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                      <p>You are not a member of any organization.</p>
                      {!canCreateOrg && (
                        <p className="mt-1 text-xs">
                          Creating organizations is limited to community leaders
                          and admins.
                        </p>
                      )}
                    </div>
                  )}

                  {orgs.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {orgs.map((org) => (
                        <li
                          key={org.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <Link
                            href={`/org/${org.slug}`}
                            className="font-medium hover:underline"
                          >
                            {org.name}
                          </Link>
                          <Badge
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {org.role.toLowerCase()}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}

                  {showCreateOrg && (
                    <div className="flex flex-col gap-3 rounded-md border p-3">
                      <FieldGroup>
                        <Field>
                          <FieldLabel htmlFor="new-org-name">Name</FieldLabel>
                          <Input
                            id="new-org-name"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                            placeholder="My Organization"
                            maxLength={50}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="new-org-slug">Slug</FieldLabel>
                          <Input
                            id="new-org-slug"
                            value={newOrgSlug}
                            onChange={(e) => setNewOrgSlug(e.target.value)}
                            placeholder="my-organization"
                            maxLength={30}
                          />
                          <FieldDescription>
                            Lowercase letters, numbers, hyphens only.
                          </FieldDescription>
                        </Field>
                      </FieldGroup>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isCreatingOrg || !newOrgName.trim()}
                        onClick={handleCreateOrg}
                      >
                        {isCreatingOrg && <Spinner />}
                        Create
                      </Button>
                    </div>
                  )}
                </div>
              </form>

              <ApiKeysSection open={open} />
            </div>
          )}
        </ScrollArea>
        <SheetFooter className="shrink-0 gap-1 border-t py-2">
          <Button
            type="submit"
            form="settings-form"
            disabled={isPending || isLoading}
          >
            {isPending && <Spinner />}
            Save Changes
          </Button>
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
