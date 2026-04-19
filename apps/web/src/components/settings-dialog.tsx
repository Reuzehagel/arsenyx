import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Bell,
  Building2,
  Link as LinkIcon,
  Lock,
  Paintbrush,
  Settings as SettingsIcon,
  User,
} from "lucide-react"
import * as React from "react"

import { Link } from "@/components/link"
import { useTheme } from "@/components/theme-provider"
import { UserAvatar } from "@/components/user-avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { authClient } from "@/lib/auth-client"
import { useCreateOrg } from "@/lib/org-actions"
import { myOrgsQuery } from "@/lib/org-query"

type SectionId =
  | "appearance"
  | "profile"
  | "account"
  | "organizations"
  | "notifications"
  | "privacy"
  | "advanced"

type Section = {
  id: SectionId
  name: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: Section[] = [
  { id: "appearance", name: "Appearance", icon: Paintbrush },
  { id: "profile", name: "Profile", icon: User },
  { id: "account", name: "Connected accounts", icon: LinkIcon },
  { id: "organizations", name: "Organizations", icon: Building2 },
  { id: "notifications", name: "Notifications", icon: Bell },
  { id: "privacy", name: "Privacy", icon: Lock },
  { id: "advanced", name: "Advanced", icon: SettingsIcon },
]

const THEMES = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
  { value: "system" as const, label: "System" },
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
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
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
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {SECTIONS.find((s) => s.id === active)?.name}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
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
      return <PlaceholderPanel title="Profile" />
    case "account":
      return <PlaceholderPanel title="Connected accounts" />
    case "organizations":
      return <OrganizationsPanel onClose={onClose} />
    case "notifications":
      return <PlaceholderPanel title="Notifications" />
    case "privacy":
      return <PlaceholderPanel title="Privacy" />
    case "advanced":
      return <PlaceholderPanel title="Advanced" />
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

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{title}</FieldLabel>
        <FieldDescription>Nothing here yet — coming soon.</FieldDescription>
        <div className="flex items-center justify-between rounded-md border p-3 opacity-60">
          <span className="text-sm">Placeholder setting</span>
          <Switch disabled />
        </div>
      </Field>
    </FieldGroup>
  )
}
