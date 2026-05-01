import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Lock,
  Paintbrush,
  Settings as SettingsIcon,
  User,
} from "lucide-react"
import * as React from "react"

import { Link } from "@/components/link"
import { useTheme } from "@/components/theme-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { UserAvatar } from "@/components/user-avatar"
import { authClient } from "@/lib/auth-client"
import type { BuildDetail } from "@/lib/build-query"
import {
  type ApiKeySummary,
  createApiKey,
  downloadMyBuildsExport,
  myApiKeysQuery,
  revokeApiKey,
} from "@/lib/me-query"
import { useCreateOrg } from "@/lib/org-actions"
import { myOrgsQuery } from "@/lib/org-query"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { authorName } from "@/lib/user-display"

type BuildVisibility = BuildDetail["visibility"]

type SessionUserExtras = {
  displayUsername: string | null
  username: string | null
  defaultBuildVisibility: BuildVisibility
}

function extras(user: object): SessionUserExtras {
  return user as SessionUserExtras
}

type SectionId =
  | "appearance"
  | "profile"
  | "organizations"
  | "privacy"
  | "api-keys"
  | "advanced"

type Section = {
  id: SectionId
  name: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: Section[] = [
  { id: "appearance", name: "Appearance", icon: Paintbrush },
  { id: "profile", name: "Profile", icon: User },
  { id: "organizations", name: "Organizations", icon: Building2 },
  { id: "privacy", name: "Privacy", icon: Lock },
  { id: "api-keys", name: "API keys", icon: KeyRound },
  { id: "advanced", name: "Advanced", icon: SettingsIcon },
]

const SECTION_SELECT_ITEMS = SECTIONS.map((s) => ({
  value: s.id,
  label: s.name,
}))

const THEMES = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
  { value: "system" as const, label: "System" },
]

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: BuildVisibility
  label: string
  description: string
}> = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Listed on the browse page and your profile.",
  },
  {
    value: "UNLISTED",
    label: "Unlisted",
    description: "Accessible by link, but not listed publicly.",
  },
  {
    value: "PRIVATE",
    label: "Private",
    description: "Only visible to you.",
  },
]

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [active, setActive] = React.useState<SectionId>("appearance")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your Arsenyx experience.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar
            collapsible="none"
            className="bg-muted/40 hidden border-r md:flex"
          >
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SECTIONS.map((item) => {
                      const Icon = item.icon
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={item.id === active}
                            onClick={() => setActive(item.id)}
                          >
                            <Icon />
                            <span>{item.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:h-[480px]">
            <header className="flex h-14 shrink-0 items-center gap-2 md:h-16">
              {/* `pr-12` on mobile leaves room for the dialog's X close
                  button which sits absolute top-right. */}
              <div className="flex w-full items-center gap-2 pr-12 pl-4 md:w-auto md:pr-4">
                <Breadcrumb className="hidden md:block">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {SECTIONS.find((s) => s.id === active)?.name}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <Select
                  items={SECTION_SELECT_ITEMS}
                  value={active}
                  onValueChange={(v) => {
                    if (v) setActive(v as SectionId)
                  }}
                >
                  <SelectTrigger className="w-full md:hidden">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SECTIONS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              <SectionPanel id={active} onClose={() => onOpenChange(false)} />
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

function SectionPanel({ id, onClose }: { id: SectionId; onClose: () => void }) {
  switch (id) {
    case "appearance":
      return <AppearancePanel />
    case "profile":
      return <ProfilePanel />
    case "organizations":
      return <OrganizationsPanel onClose={onClose} />
    case "privacy":
      return <PrivacyPanel />
    case "api-keys":
      return <ApiKeysPanel />
    case "advanced":
      return <AdvancedPanel />
  }
}

function AppearancePanel() {
  const { theme, setTheme } = useTheme()
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Theme</FieldLabel>
        <FieldDescription>
          Choose how Arsenyx looks. System follows your OS preference.
        </FieldDescription>
        <div className="flex gap-2 pt-1">
          {THEMES.map((t) => (
            <Button
              key={t.value}
              variant={theme === t.value ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </Field>
    </FieldGroup>
  )
}

function SignedOutNotice({ message }: { message: string }) {
  return (
    <FieldGroup>
      <Field>
        <FieldDescription>{message}</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

function ProfilePanel() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  if (!user) {
    return <SignedOutNotice message="Sign in to edit your profile." />
  }

  return <ProfileForm key={user.id} user={user} />
}

function ProfileForm({
  user,
}: {
  user: NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"]
}) {
  const queryClient = useQueryClient()
  const initial = extras(user).displayUsername ?? extras(user).username ?? ""
  const [displayUsername, setDisplayUsername] = React.useState(initial)

  const save = useMutation({
    mutationFn: async (next: string) => {
      const res = await authClient.updateUser({ displayUsername: next })
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to update profile.")
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })

  const trimmed = displayUsername.trim()
  const currentUsername = extras(user).username
  const dirty = trimmed !== initial.trim() && trimmed.length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty) save.mutate(trimmed)
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>Account</FieldLabel>
          <FieldDescription>
            Your name and avatar are synced from GitHub.
          </FieldDescription>
          <div className="flex items-center gap-3 pt-1">
            <UserAvatar
              src={user.image ?? null}
              fallback={user.name || user.email}
              size={10}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {user.email}
              </span>
            </div>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="display-username">Display username</FieldLabel>
          <FieldDescription>
            Shown on your builds and profile. Your handle
            {currentUsername ? ` (@${currentUsername})` : ""} stays the same.
          </FieldDescription>
          <Input
            id="display-username"
            value={displayUsername}
            onChange={(e) => setDisplayUsername(e.target.value)}
            maxLength={50}
            placeholder={currentUsername ?? "Display name"}
          />
        </Field>
        {save.error ? (
          <p className="text-destructive text-sm">{save.error.message}</p>
        ) : save.isSuccess ? (
          <p className="text-muted-foreground text-sm">Saved.</p>
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

function OrganizationsPanel({ onClose }: { onClose: () => void }) {
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

function PrivacyPanel() {
  const { data: session } = authClient.useSession()
  const user = session?.user
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: async (visibility: BuildVisibility) => {
      const res = await authClient.updateUser({
        defaultBuildVisibility: visibility,
      } as Parameters<typeof authClient.updateUser>[0])
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to update preference.")
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })

  if (!user) {
    return <SignedOutNotice message="Sign in to manage privacy preferences." />
  }

  const current = extras(user).defaultBuildVisibility ?? "PUBLIC"
  const effective = update.isPending ? update.variables : current

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="default-visibility">
          Default build visibility
        </FieldLabel>
        <FieldDescription>
          Visibility applied when you create a new build without choosing one.
          Existing builds aren't changed.
        </FieldDescription>
        <Select
          items={VISIBILITY_OPTIONS}
          value={effective}
          onValueChange={(v) => {
            if (v && v !== current) update.mutate(v as BuildVisibility)
          }}
        >
          <SelectTrigger id="default-visibility" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {VISIBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{o.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {o.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {update.error ? (
          <p className="text-destructive text-sm">{update.error.message}</p>
        ) : null}
      </Field>
    </FieldGroup>
  )
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
] as const

type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]["value"]

function expiryToDate(v: ExpiryValue): string | null {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  switch (v) {
    case "never":
      return null
    case "30d":
      return new Date(now + 30 * day).toISOString()
    case "90d":
      return new Date(now + 90 * day).toISOString()
    case "1y":
      return new Date(now + 365 * day).toISOString()
  }
}

function formatDate(iso: string | null, fallback = "Never") {
  if (!iso) return fallback
  return new Date(iso).toLocaleDateString()
}

function ApiKeysPanel() {
  const { data: session } = authClient.useSession()
  const signedIn = !!session?.user

  const keysQuery = useQuery({ ...myApiKeysQuery(), enabled: signedIn })

  if (!signedIn) {
    return <SignedOutNotice message="Sign in to manage API keys." />
  }

  const keys = keysQuery.data?.apiKeys ?? []
  const activeCount = keys.filter((k) => k.isActive).length

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>API keys</FieldLabel>
        <FieldDescription>
          Authenticate the Arsenyx public API from scripts or tools. Tokens are
          shown once on creation — store them somewhere safe.
        </FieldDescription>
      </Field>

      <CreateApiKeyForm disabled={activeCount >= 10} />

      {keysQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No API keys yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k) => (
            <ApiKeyRow key={k.id} apiKey={k} />
          ))}
        </div>
      )}
    </FieldGroup>
  )
}

type ScopeOption = {
  value: string
  label: string
  description: string
  privileged?: boolean
}

const SCOPE_OPTIONS: readonly ScopeOption[] = [
  {
    value: "build:read",
    label: "build:read",
    description: "Read public builds via /api/v1",
  },
  {
    value: "build:write",
    label: "build:write",
    description: "Import builds (/api/v1/imports/overframe)",
  },
]

const DEFAULT_SCOPES = SCOPE_OPTIONS.filter((s) => !s.privileged).map(
  (s) => s.value,
)

function CreateApiKeyForm({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const user = session?.user as
    | { isAdmin?: boolean; isModerator?: boolean }
    | undefined
  const canUsePrivileged = user?.isAdmin === true || user?.isModerator === true

  const [name, setName] = React.useState("")
  const [expiry, setExpiry] = React.useState<ExpiryValue>("never")
  const [scopes, setScopes] = React.useState<Set<string>>(
    () => new Set(DEFAULT_SCOPES),
  )
  const [justCreated, setJustCreated] = React.useState<{
    token: string
    apiKey: ApiKeySummary
  } | null>(null)
  const { copied, copy } = useCopyToClipboard()

  const toggleScope = (scope: string) => {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  const create = useMutation({
    mutationFn: () =>
      createApiKey({
        name: name.trim(),
        expiresAt: expiryToDate(expiry),
        scopes: Array.from(scopes),
      }),
    onSuccess: (data) => {
      setJustCreated(data)
      setName("")
      setExpiry("never")
      setScopes(new Set(DEFAULT_SCOPES))
      void queryClient.invalidateQueries({ queryKey: ["me", "api-keys"] })
    },
  })

  if (justCreated) {
    return (
      <Field>
        <FieldLabel>New API key</FieldLabel>
        <FieldDescription>
          Copy this token now. You won't be able to see it again.
        </FieldDescription>
        <div className="bg-muted/40 flex items-center gap-2 rounded-md border p-2">
          <code className="flex-1 truncate font-mono text-xs">
            {justCreated.token}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copy(justCreated.token)}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="pt-1">
          <Button type="button" size="sm" onClick={() => setJustCreated(null)}>
            Done
          </Button>
        </div>
      </Field>
    )
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || create.isPending || disabled) return
        create.mutate()
      }}
    >
      <Field>
        <FieldLabel htmlFor="new-api-key-name">Create API key</FieldLabel>
        <FieldDescription>
          A human-friendly label so you remember what this key is for.
        </FieldDescription>
        <Input
          id="new-api-key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CI import script"
          maxLength={100}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-api-key-expiry">Expires</FieldLabel>
        <Select
          items={EXPIRY_OPTIONS}
          value={expiry}
          onValueChange={(v) => {
            if (v) setExpiry(v as ExpiryValue)
          }}
        >
          <SelectTrigger id="new-api-key-expiry" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Scopes</FieldLabel>
        <FieldDescription>
          Controls which endpoints this key can access.
        </FieldDescription>
        <div className="flex flex-col gap-1.5">
          {SCOPE_OPTIONS.filter((s) => !s.privileged || canUsePrivileged).map(
            (s) => (
              <ScopeCheckbox
                key={s.value}
                id={`scope-${s.value}`}
                label={s.label}
                description={s.description}
                checked={scopes.has(s.value)}
                onChange={() => toggleScope(s.value)}
              />
            ),
          )}
        </div>
      </Field>
      {create.error ? (
        <p className="text-destructive text-sm">{create.error.message}</p>
      ) : disabled ? (
        <p className="text-muted-foreground text-sm">
          You've reached the 10 active key limit. Revoke one to create another.
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          size="sm"
          disabled={
            !name.trim() || create.isPending || disabled || scopes.size === 0
          }
        >
          {create.isPending ? "Creating…" : "Create key"}
        </Button>
      </div>
    </form>
  )
}

function ScopeCheckbox({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-md p-1.5"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <div className="flex flex-col">
        <code className="font-mono text-xs">{label}</code>
        <span className="text-muted-foreground text-xs">{description}</span>
      </div>
    </label>
  )
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKeySummary }) {
  const queryClient = useQueryClient()
  const revoke = useMutation({
    mutationFn: () => revokeApiKey(apiKey.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me", "api-keys"] })
    },
  })

  const onRevoke = () => {
    if (!window.confirm(`Revoke "${apiKey.name}"? This cannot be undone.`)) {
      return
    }
    revoke.mutate()
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{apiKey.name}</span>
          {!apiKey.isActive ? (
            <span className="text-muted-foreground text-xs">(revoked)</span>
          ) : null}
        </div>
        <code className="text-muted-foreground truncate font-mono text-xs">
          {apiKey.keyPrefix}…
        </code>
        <span className="text-muted-foreground text-xs">
          Created {formatDate(apiKey.createdAt)} · Expires{" "}
          {formatDate(apiKey.expiresAt)} · Last used{" "}
          {formatDate(apiKey.lastUsedAt)}
        </span>
      </div>
      {apiKey.isActive ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRevoke}
          disabled={revoke.isPending}
        >
          {revoke.isPending ? "Revoking…" : "Revoke"}
        </Button>
      ) : null}
    </div>
  )
}

function AdvancedPanel() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  const exportAction = useMutation({ mutationFn: downloadMyBuildsExport })
  const revokeAction = useMutation({
    mutationFn: async () => {
      const res = await authClient.revokeOtherSessions()
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to revoke sessions.")
      }
    },
  })

  const [deleteOpen, setDeleteOpen] = React.useState(false)

  if (!user) {
    return <SignedOutNotice message="Sign in to access advanced settings." />
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Export my builds</FieldLabel>
        <FieldDescription>
          Download every build you've created as a single JSON file.
        </FieldDescription>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => exportAction.mutate()}
            disabled={exportAction.isPending}
          >
            {exportAction.isPending ? "Preparing…" : "Download JSON"}
          </Button>
          {exportAction.error ? (
            <span className="text-destructive text-sm">
              {exportAction.error.message}
            </span>
          ) : null}
        </div>
      </Field>

      <Field>
        <FieldLabel>Sign out other sessions</FieldLabel>
        <FieldDescription>
          Signs out every other browser and device. Your current session stays
          active.
        </FieldDescription>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => revokeAction.mutate()}
            disabled={revokeAction.isPending}
          >
            {revokeAction.isPending
              ? "Signing out…"
              : "Sign out other sessions"}
          </Button>
          {revokeAction.isSuccess ? (
            <span className="text-muted-foreground text-sm">
              Other sessions signed out.
            </span>
          ) : revokeAction.error ? (
            <span className="text-destructive text-sm">
              {revokeAction.error.message}
            </span>
          ) : null}
        </div>
      </Field>

      <Field>
        <FieldLabel className="text-destructive">Delete account</FieldLabel>
        <FieldDescription>
          Permanently deletes your account, builds, likes, and bookmarks. This
          cannot be undone.
        </FieldDescription>
        <div className="pt-1">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete account…
          </Button>
        </div>
      </Field>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        expected={authorName(extras(user), user.email)}
      />
    </FieldGroup>
  )
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  expected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expected: string
}) {
  const [value, setValue] = React.useState("")
  const del = useMutation({
    mutationFn: async () => {
      const res = await authClient.deleteUser()
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to delete account.")
      }
    },
    onSuccess: () => {
      window.location.href = "/"
    },
  })

  React.useEffect(() => {
    if (!open) {
      setValue("")
      del.reset()
    }
  }, [open, del])

  const confirmed = value === expected

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogTitle>Delete account</DialogTitle>
        <DialogDescription>
          This permanently deletes your account and every build, like, and
          bookmark tied to it. Type{" "}
          <code className="font-mono">{expected}</code> to confirm.
        </DialogDescription>
        <div className="flex flex-col gap-3 pt-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={expected}
            autoComplete="off"
          />
          {del.error ? (
            <p className="text-destructive text-sm">{del.error.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!confirmed || del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
