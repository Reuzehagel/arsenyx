import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Suspense, useState } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"
import {
  adminBuildsQuery,
  adminOrgsQuery,
  adminStatsQuery,
  adminUsersQuery,
  type AdminOrg,
  type AdminUser,
  type AdminUserFlag,
  useAdminDeleteBuild,
  useAdminDeleteOrg,
  useAdminDeleteUser,
  useAdminPatchUser,
} from "@/lib/admin-actions"
import { authClient } from "@/lib/auth-client"

const TABS = ["users", "content", "orgs", "stats"] as const
type AdminTab = (typeof TABS)[number]

type AdminSearch = {
  tab?: AdminTab
  page?: number
  q?: string
}

function parseSearch(search: Record<string, unknown>): AdminSearch {
  const tabRaw = search.tab
  const tab = (TABS as readonly string[]).includes(tabRaw as string)
    ? (tabRaw as AdminTab)
    : undefined
  const pageRaw =
    typeof search.page === "number"
      ? search.page
      : parseInt(String(search.page ?? ""), 10)
  const page =
    Number.isFinite(pageRaw) && pageRaw > 1 ? (pageRaw as number) : undefined
  const qRaw = typeof search.q === "string" ? search.q.trim() : ""
  const q = qRaw.length > 0 ? qRaw : undefined
  return { tab, page, q }
}

export const Route = createFileRoute("/admin")({
  validateSearch: (search): AdminSearch => parseSearch(search),
  beforeLoad: async () => {
    const session = await authClient.getSession()
    const user = session.data?.user as { isAdmin?: boolean } | undefined
    if (!user || user.isAdmin !== true) {
      throw redirect({ to: "/" })
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const tab: AdminTab = search.tab ?? "users"

  function setTab(next: AdminTab) {
    void navigate({
      search: { tab: next === "users" ? undefined : next },
      replace: true,
    })
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex max-w-5xl flex-col gap-6 py-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">
              Moderation, content, and metrics.
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as AdminTab)}
            className="flex-col"
          >
            <TabsList className="h-8">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="orgs">Orgs</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Suspense fallback={<LoadingRow />}>
                <UsersTab page={search.page ?? 1} q={search.q ?? ""} />
              </Suspense>
            </TabsContent>
            <TabsContent value="content">
              <Suspense fallback={<LoadingRow />}>
                <ContentTab page={search.page ?? 1} q={search.q ?? ""} />
              </Suspense>
            </TabsContent>
            <TabsContent value="orgs">
              <Suspense fallback={<LoadingRow />}>
                <OrgsTab page={search.page ?? 1} q={search.q ?? ""} />
              </Suspense>
            </TabsContent>
            <TabsContent value="stats">
              <Suspense fallback={<LoadingRow />}>
                <StatsTab />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function LoadingRow() {
  return <p className="text-muted-foreground py-4 text-sm">Loading…</p>
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [local, setLocal] = useState(value)
  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    onChange(local.trim())
  }
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="max-w-sm"
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  )
}

// ---------------- Users

function UsersTab({ page, q }: { page: number; q: string }) {
  const navigate = useNavigate({ from: Route.fullPath })
  const { data } = useSuspenseQuery(adminUsersQuery({ page, q }))
  const { data: session } = authClient.useSession()
  const selfId = session?.user?.id ?? null

  function updateSearch(next: Partial<AdminSearch>) {
    void navigate({
      search: (prev) => ({ ...prev, ...next }),
      replace: true,
    })
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <SearchBar
        value={q}
        placeholder="Search by username, email, or name"
        onChange={(v) => updateSearch({ q: v || undefined, page: undefined })}
      />
      {data.users.length === 0 ? (
        <p className="text-muted-foreground text-sm">No users found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === selfId} />
          ))}
        </div>
      )}
      <Pagination
        page={page}
        total={data.total}
        limit={data.limit}
        onPage={(p) => updateSearch({ page: p > 1 ? p : undefined })}
      />
    </div>
  )
}

function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const patch = useAdminPatchUser()
  const del = useAdminDeleteUser()
  const display =
    user.displayUsername ?? user.username ?? user.name ?? user.email

  function toggle(flag: AdminUserFlag) {
    patch.mutate({ id: user.id, patch: { [flag]: !user[flag] } })
  }

  const error = patch.error instanceof Error ? patch.error.message : null

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center">
      <UserAvatar src={user.image} fallback={display} size={10} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{display}</span>
          {user.isAdmin ? <Badge variant="destructive">Admin</Badge> : null}
          {user.isModerator ? <Badge>Mod</Badge> : null}
          {user.isCommunityLeader ? <Badge variant="outline">CL</Badge> : null}
          {user.isVerified ? <Badge variant="outline">✓</Badge> : null}
          {user.isBanned ? <Badge variant="destructive">Banned</Badge> : null}
        </div>
        <span className="text-muted-foreground truncate text-xs">
          {user.email} · {user.buildCount} builds ·{" "}
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <FlagButton
          label="Admin"
          active={user.isAdmin}
          disabled={isSelf && user.isAdmin}
          onClick={() => toggle("isAdmin")}
        />
        <FlagButton
          label="Mod"
          active={user.isModerator}
          onClick={() => toggle("isModerator")}
        />
        <FlagButton
          label="CL"
          active={user.isCommunityLeader}
          onClick={() => toggle("isCommunityLeader")}
        />
        <FlagButton
          label="Verified"
          active={user.isVerified}
          onClick={() => toggle("isVerified")}
        />
        <FlagButton
          label="Ban"
          danger
          active={user.isBanned}
          disabled={isSelf && !user.isBanned}
          onClick={() => toggle("isBanned")}
        />
        <DeleteUserDialog
          user={user}
          isSelf={isSelf}
          onConfirm={() => del.mutate(user.id)}
          pending={del.isPending}
        />
      </div>
    </div>
  )
}

function FlagButton({
  label,
  active,
  danger,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      size="sm"
      variant={active ? (danger ? "destructive" : "default") : "secondary"}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </Button>
  )
}

function DeleteUserDialog({
  user,
  isSelf,
  onConfirm,
  pending,
}: {
  user: AdminUser
  isSelf: boolean
  onConfirm: () => void
  pending: boolean
}) {
  const display = user.displayUsername ?? user.username ?? user.email
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" variant="destructive" disabled={isSelf}>
            Delete
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Permanently delete <span className="font-semibold">{display}</span>{" "}
            and all of their builds, likes, bookmarks, and memberships. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary">Cancel</Button>} />
          <DialogClose
            render={
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete"}
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Content (builds)

function ContentTab({ page, q }: { page: number; q: string }) {
  const navigate = useNavigate({ from: Route.fullPath })
  const { data } = useSuspenseQuery(adminBuildsQuery({ page, q }))
  const del = useAdminDeleteBuild()

  function updateSearch(next: Partial<AdminSearch>) {
    void navigate({
      search: (prev) => ({ ...prev, ...next }),
      replace: true,
    })
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <SearchBar
        value={q}
        placeholder="Search builds"
        onChange={(v) => updateSearch({ q: v || undefined, page: undefined })}
      />
      {data.builds.length === 0 ? (
        <p className="text-muted-foreground text-sm">No builds found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.builds.map((b) => {
            const author =
              b.user.displayUsername ?? b.user.username ?? b.user.name ?? "—"
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/builds/${b.slug}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {b.name}
                    </Link>
                    {b.visibility !== "PUBLIC" ? (
                      <Badge variant="outline">
                        {b.visibility.toLowerCase()}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground truncate text-xs">
                    {b.item.name} · {b.item.category} · by {author} ·{" "}
                    {b.likeCount}♥ · {b.bookmarkCount}★
                  </span>
                </div>
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button size="sm" variant="destructive">
                        Delete
                      </Button>
                    }
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete build</DialogTitle>
                      <DialogDescription>
                        Permanently delete{" "}
                        <span className="font-semibold">{b.name}</span>. This
                        cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose
                        render={<Button variant="secondary">Cancel</Button>}
                      />
                      <DialogClose
                        render={
                          <Button
                            variant="destructive"
                            onClick={() => del.mutate(b.slug)}
                            disabled={del.isPending}
                          >
                            {del.isPending ? "Deleting…" : "Delete"}
                          </Button>
                        }
                      />
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )
          })}
        </div>
      )}
      <Pagination
        page={page}
        total={data.total}
        limit={data.limit}
        onPage={(p) => updateSearch({ page: p > 1 ? p : undefined })}
      />
    </div>
  )
}

// ---------------- Orgs

function OrgsTab({ page, q }: { page: number; q: string }) {
  const navigate = useNavigate({ from: Route.fullPath })
  const { data } = useSuspenseQuery(adminOrgsQuery({ page, q }))

  function updateSearch(next: Partial<AdminSearch>) {
    void navigate({
      search: (prev) => ({ ...prev, ...next }),
      replace: true,
    })
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <SearchBar
        value={q}
        placeholder="Search orgs by name or slug"
        onChange={(v) => updateSearch({ q: v || undefined, page: undefined })}
      />
      {data.orgs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No orgs found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.orgs.map((o) => (
            <OrgRow key={o.id} org={o} />
          ))}
        </div>
      )}
      <Pagination
        page={page}
        total={data.total}
        limit={data.limit}
        onPage={(p) => updateSearch({ page: p > 1 ? p : undefined })}
      />
    </div>
  )
}

function OrgRow({ org }: { org: AdminOrg }) {
  const del = useAdminDeleteOrg()
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <UserAvatar
        src={org.image}
        fallback={org.name}
        size={10}
        shape="rounded"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/org/${org.slug}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {org.name}
        </Link>
        <span className="text-muted-foreground truncate text-xs">
          /{org.slug} · {org.memberCount} members · {org.buildCount} builds
        </span>
      </div>
      <Dialog>
        <DialogTrigger
          render={
            <Button size="sm" variant="destructive">
              Delete
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <span className="font-semibold">{org.name}</span>. Its{" "}
              {org.buildCount} build(s) will be unlinked (not deleted). This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary">Cancel</Button>} />
            <DialogClose
              render={
                <Button
                  variant="destructive"
                  onClick={() => del.mutate(org.slug)}
                  disabled={del.isPending}
                >
                  {del.isPending ? "Deleting…" : "Delete"}
                </Button>
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Stats

function StatsTab() {
  const { data } = useSuspenseQuery(adminStatsQuery())
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <StatCard label="Users" value={data.userCount} />
        <StatCard label="Organizations" value={data.orgCount} />
        <StatCard label="Builds" value={data.buildCount} />
        <StatCard label="Builds (24h)" value={data.buildsDay} />
        <StatCard label="Builds (7d)" value={data.buildsWeek} />
        <StatCard label="Builds (30d)" value={data.buildsMonth} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Builds by category</CardTitle>
        </CardHeader>
        <CardContent>
          {data.buildsByCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">No builds yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.buildsByCategory.map((r) => (
                <li
                  key={r.category}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize">{r.category}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-normal">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-bold tabular-nums">
          {value.toLocaleString()}
        </span>
      </CardContent>
    </Card>
  )
}
