import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, X } from "lucide-react"
import { Suspense, useState } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
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
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { authClient } from "@/lib/auth-client"
import {
  useAddOrgMember,
  useDeleteOrg,
  useRemoveOrgMember,
  useUpdateOrg,
  useUpdateOrgMemberRole,
} from "@/lib/org-actions"
import { orgQuery, type OrgProfile, type OrgRole } from "@/lib/org-query"

export const Route = createFileRoute("/org/$slug_/settings")({
  beforeLoad: async ({ context, params }) => {
    const session = await authClient.getSession()
    if (!session.data?.user) {
      throw redirect({ to: "/auth/signin" })
    }
    const org = await context.queryClient.ensureQueryData(orgQuery(params.slug))
    if (!org.viewer.isAdmin) {
      throw redirect({ to: "/org/$slug", params: { slug: params.slug } })
    }
  },
  component: OrgSettingsPage,
})

function OrgSettingsPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex max-w-3xl flex-col gap-6 py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading…</p>}
          >
            <OrgSettingsContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function OrgSettingsContent() {
  const { slug } = Route.useParams()
  const { data: org } = useSuspenseQuery(orgQuery(slug))

  return (
    <>
      <Link
        href={`/org/${org.slug}`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to {org.name}
      </Link>

      <GeneralCard org={org} />
      <MembersCard org={org} />
      <DangerCard org={org} />
    </>
  )
}

function GeneralCard({ org }: { org: OrgProfile }) {
  const navigate = useNavigate()
  const update = useUpdateOrg(org.slug)

  const [name, setName] = useState(org.name)
  const [slug, setSlug] = useState(org.slug)
  const [image, setImage] = useState(org.image ?? "")
  const [description, setDescription] = useState(org.description ?? "")

  const error = update.error instanceof Error ? update.error.message : null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    update.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        image: image.trim() || null,
        description: description.trim() || null,
      },
      {
        onSuccess: (data) => {
          if (data.slug !== org.slug) {
            void navigate({
              to: "/org/$slug/settings",
              params: { slug: data.slug },
              replace: true,
            })
          }
        },
      },
    )
  }

  const nameError = error?.toLowerCase().includes("name")
  const slugError = error?.toLowerCase().includes("slug")

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Update your organization's public information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={nameError ? true : undefined}>
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

            <Field data-invalid={slugError ? true : undefined}>
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
              <FieldDescription>/org/{slug || "org-slug"}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="org-image">Avatar URL</FieldLabel>
              <Input
                id="org-image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
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

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function MembersCard({ org }: { org: OrgProfile }) {
  const addMember = useAddOrgMember(org.slug)
  const removeMember = useRemoveOrgMember(org.slug)
  const updateRole = useUpdateOrgMemberRole(org.slug)

  const [addUsername, setAddUsername] = useState("")

  const addError =
    addMember.error instanceof Error ? addMember.error.message : null
  const rowError =
    (removeMember.error instanceof Error && removeMember.error.message) ||
    (updateRole.error instanceof Error && updateRole.error.message) ||
    null

  function onAdd(e: React.FormEvent) {
    e.preventDefault()
    const u = addUsername.trim()
    if (!u) return
    addMember.mutate(u, {
      onSuccess: () => setAddUsername(""),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Manage organization members and their roles
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {org.members.map((m) => {
            const display =
              m.user.displayUsername ??
              m.user.username ??
              m.user.name ??
              "Member"
            return (
              <li
                key={m.user.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <UserAvatar src={m.user.image} fallback={display} size={8} />
                <span className="flex-1 truncate text-sm font-medium">
                  {display}
                </span>

                <Select
                  value={m.role}
                  onValueChange={(val) => {
                    if (val && val !== m.role) {
                      updateRole.mutate({
                        userId: m.user.id,
                        role: val as OrgRole,
                      })
                    }
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

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember.mutate(m.user.id)}
                  disabled={removeMember.isPending}
                  className="text-destructive hover:text-destructive"
                  aria-label={`Remove ${display}`}
                >
                  <X className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>

        {rowError ? <FieldError>{rowError}</FieldError> : null}

        <form onSubmit={onAdd} className="flex flex-col gap-2">
          <FieldLabel htmlFor="add-member">Add Member</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="add-member"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="username"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={addMember.isPending || !addUsername.trim()}
            >
              {addMember.isPending ? "Adding…" : "Add"}
            </Button>
          </div>
          {addError ? <FieldError>{addError}</FieldError> : null}
        </form>
      </CardContent>
    </Card>
  )
}

function DangerCard({ org }: { org: OrgProfile }) {
  const navigate = useNavigate()
  const del = useDeleteOrg(org.slug)
  const [confirm, setConfirm] = useState("")
  const canDelete = confirm === org.name && !del.isPending
  const error = del.error instanceof Error ? del.error.message : null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (confirm !== org.name) return
    del.mutate(undefined, {
      onSuccess: () => {
        void navigate({ to: "/" })
      },
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this organization. This action cannot be undone.
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
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={org.name}
                autoComplete="off"
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="destructive" disabled={!canDelete}>
            {del.isPending ? "Deleting…" : "Delete Organization"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
