import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import * as React from "react"

import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import { authClient } from "@/lib/auth-client"
import { useCreateOrg } from "@/lib/queries/org-actions"
import { myOrgsQuery } from "@/lib/queries/org-query"

export function OrganizationsPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = authClient.useSession()
  const signedIn = !!session?.user

  const orgsQuery = useQuery({
    ...myOrgsQuery(),
    enabled: signedIn,
  })

  if (!signedIn) {
    return (
      <FieldGroup>
        <Field>
          <FieldLabel>Organizations</FieldLabel>
          <FieldDescription>
            Sign in to create and manage organizations.
          </FieldDescription>
        </Field>
      </FieldGroup>
    )
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Your organizations</FieldLabel>
        <FieldDescription>
          Organizations you belong to. Publishing builds under an organization
          is coming soon.
        </FieldDescription>
        {orgsQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : orgsQuery.data && orgsQuery.data.memberships.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {orgsQuery.data.memberships.map((m) => {
              return (
                <li key={m.organization.id}>
                  <Link
                    href={`/org/${m.organization.slug}`}
                    className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-2 transition-colors"
                    onClick={onClose}
                  >
                    <UserAvatar
                      src={m.organization.image}
                      fallback={m.organization.name}
                      size={9}
                      shape="rounded"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {m.organization.name}
                      </span>
                    </div>
                    {m.role === "ADMIN" ? (
                      <span className="text-muted-foreground text-xs">
                        Admin
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            You aren't a member of any organizations yet.
          </p>
        )}
      </Field>
      <CreateOrgForm onClose={onClose} />
    </FieldGroup>
  )
}

function CreateOrgForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const create = useCreateOrg()
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")

  const error = create.error instanceof Error ? create.error.message : null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const s = slug.trim()
    if (!n || !s) return
    create.mutate(
      {
        name: n,
        slug: s,
        description: description.trim() || null,
      },
      {
        onSuccess: (data) => {
          setName("")
          setSlug("")
          setDescription("")
          onClose()
          void navigate({ to: "/org/$slug", params: { slug: data.slug } })
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="new-org-name">Create organization</FieldLabel>
        <FieldDescription>
          Your organization will get a public page at /org/[slug].
        </FieldDescription>
        <Input
          id="new-org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Organization name"
          maxLength={50}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-org-slug">Slug</FieldLabel>
        <Input
          id="new-org-slug"
          value={slug}
          onChange={(e) =>
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          placeholder="org-slug"
          maxLength={30}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-org-description">Description</FieldLabel>
        <Input
          id="new-org-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
          maxLength={200}
        />
      </Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div>
        <Button
          type="submit"
          size="sm"
          disabled={create.isPending || !name.trim() || !slug.trim()}
        >
          {create.isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  )
}
