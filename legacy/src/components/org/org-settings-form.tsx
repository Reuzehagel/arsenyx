"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  updateOrganizationAction,
  addOrgMemberAction,
  removeOrgMemberAction,
  updateMemberRoleAction,
  deleteOrganizationAction,
} from "@/app/actions/organizations"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { OrganizationProfile } from "@/lib/db/organizations"

interface OrgSettingsFormProps {
  org: OrganizationProfile
}

export function OrgSettingsForm({ org }: OrgSettingsFormProps) {
  const router = useRouter()

  // General section state
  const [name, setName] = useState(org.name)
  const [slug, setSlug] = useState(org.slug)
  const [avatarUrl, setAvatarUrl] = useState(org.image ?? "")
  const [description, setDescription] = useState(org.description ?? "")
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isGeneralPending, startGeneralTransition] = useTransition()

  // Members section state
  const [members, setMembers] = useState(org.members)
  const [addUsername, setAddUsername] = useState("")
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [isAddingMember, startAddMemberTransition] = useTransition()
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(
    null,
  )

  // Delete section state
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, startDeleteTransition] = useTransition()

  function handleGeneralSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)

    startGeneralTransition(async () => {
      const result = await updateOrganizationAction(org.id, {
        name: name.trim(),
        slug: slug.trim(),
        image: avatarUrl.trim() || null,
        description: description.trim() || null,
      })

      if (result.success) {
        toast.success("Organization updated")
        // If slug changed, redirect to new settings URL
        const newSlug = result.data?.slug ?? slug
        if (newSlug !== org.slug) {
          router.replace(`/org/${newSlug}/settings`)
        } else {
          router.refresh()
        }
      } else {
        setGeneralError(result.error)
        toast.error(result.error)
      }
    })
  }

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    setAddMemberError(null)
    const username = addUsername.trim()
    if (!username) return

    startAddMemberTransition(async () => {
      const result = await addOrgMemberAction(org.id, username)

      if (result.success) {
        toast.success(`Added ${username} to the organization`)
        setAddUsername("")
        router.refresh()
      } else {
        setAddMemberError(result.error)
        toast.error(result.error)
      }
    })
  }

  async function handleRemoveMember(userId: string, displayName: string) {
    setRemovingUserId(userId)
    const result = await removeOrgMemberAction(org.id, userId)
    setRemovingUserId(null)

    if (result.success) {
      toast.success(`Removed ${displayName} from the organization`)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } else {
      toast.error(result.error)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingRoleUserId(userId)
    const result = await updateMemberRoleAction(
      org.id,
      userId,
      newRole as "ADMIN" | "MEMBER",
    )
    setUpdatingRoleUserId(null)

    if (result.success) {
      toast.success("Role updated")
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId
            ? { ...m, role: newRole as "ADMIN" | "MEMBER" }
            : m,
        ),
      )
    } else {
      toast.error(result.error)
    }
  }

  function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (deleteConfirm !== org.name) return

    startDeleteTransition(async () => {
      const result = await deleteOrganizationAction(org.id)

      if (result.success) {
        toast.success("Organization deleted")
        router.push("/settings")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href={`/org/${org.slug}`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to {org.name}
      </Link>

      {/* General Settings */}
      <form onSubmit={handleGeneralSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>
              Update your organization's public information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field
                data-invalid={
                  generalError && generalError.toLowerCase().includes("name")
                    ? true
                    : undefined
                }
              >
                <FieldLabel htmlFor="org-name">Name</FieldLabel>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Organization name"
                  maxLength={50}
                  required
                />
              </Field>

              <Field
                data-invalid={
                  generalError && generalError.toLowerCase().includes("slug")
                    ? true
                    : undefined
                }
              >
                <FieldLabel htmlFor="org-slug">Slug</FieldLabel>
                <Input
                  id="org-slug"
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    )
                  }
                  placeholder="org-slug"
                  maxLength={30}
                  required
                />
                <FieldDescription>
                  URL: arsenyx.com/org/{slug || "org-slug"}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="org-avatar">Avatar URL</FieldLabel>
                <Input
                  id="org-avatar"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  type="url"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="org-description">Description</FieldLabel>
                <Textarea
                  id="org-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell others about your organization…"
                  maxLength={200}
                  rows={3}
                />
                <FieldDescription>{description.length}/200</FieldDescription>
              </Field>

              {generalError && <FieldError>{generalError}</FieldError>}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isGeneralPending}>
              {isGeneralPending && <Spinner />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Manage organization members and their roles
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Member list */}
          <div className="flex flex-col gap-2">
            {members.map((member) => {
              const displayName =
                member.user.displayUsername ??
                member.user.username ??
                member.user.name ??
                "Unknown"
              const isRemoving = removingUserId === member.userId
              const isUpdatingRole = updatingRoleUserId === member.userId

              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage
                      src={member.user.image ?? undefined}
                      alt={displayName}
                    />
                    <AvatarFallback className="text-sm font-medium">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <span className="flex-1 text-sm font-medium">
                    {displayName}
                  </span>

                  <div className="flex items-center gap-2">
                    {isUpdatingRole ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(val) => {
                          if (val) handleRoleChange(member.userId, val)
                        }}
                        items={[
                          { value: "ADMIN", label: "Admin" },
                          { value: "MEMBER", label: "Member" },
                        ]}
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="MEMBER">Member</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleRemoveMember(member.userId, displayName)
                      }
                      disabled={isRemoving}
                      className="text-destructive hover:text-destructive"
                    >
                      {isRemoving ? <Spinner className="size-4" /> : "Remove"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add member form */}
          <form onSubmit={handleAddMember} className="flex flex-col gap-2">
            <FieldLabel htmlFor="add-member">Add Member</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="add-member"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="Username"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={isAddingMember || !addUsername.trim()}
              >
                {isAddingMember && <Spinner />}
                Add Member
              </Button>
            </div>
            {addMemberError && <FieldError>{addMemberError}</FieldError>}
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <form onSubmit={handleDelete}>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete this organization. This action cannot be
              undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="delete-confirm">
                  Type <span className="font-semibold">{org.name}</span> to
                  confirm
                </FieldLabel>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={org.name}
                  autoComplete="off"
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={isDeleting || deleteConfirm !== org.name}
            >
              {isDeleting && <Spinner />}
              Delete Organization
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
