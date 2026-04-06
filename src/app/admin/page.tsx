import { notFound } from "next/navigation"

import { AdminContentTable } from "@/components/admin/admin-content-tab"
import { AdminDevToolsTab } from "@/components/admin/admin-dev-tools-tab"
import { AdminStatsTab } from "@/components/admin/admin-stats-tab"
import { AdminUsersTab } from "@/components/admin/admin-users-tab"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getServerSession } from "@/lib/auth"
import { getAdminBuilds } from "@/lib/db/admin"

export const metadata = { title: "Admin | ARSENYX" }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>
}) {
  const session = await getServerSession()
  if (!session?.user?.isAdmin) notFound()

  const { tab = "users", q } = await searchParams

  // Fetch builds for content tab (server-side)
  const builds = tab === "content" ? await getAdminBuilds(q) : []

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Admin Panel</h1>
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="dev-tools">Dev Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsersTab search={q} />
        </TabsContent>

        <TabsContent value="content">
          <div className="space-y-4 pt-4">
            <form action="/admin" className="flex gap-2">
              <input type="hidden" name="tab" value="content" />
              <Input
                name="q"
                placeholder="Search builds..."
                defaultValue={q}
                className="max-w-sm"
              />
            </form>

            <div className="relative w-full overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors">
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Build
                    </th>
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Author
                    </th>
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Category
                    </th>
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Item
                    </th>
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Votes
                    </th>
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Favs
                    </th>
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Created
                    </th>
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AdminContentTable builds={builds} />
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <AdminStatsTab />
        </TabsContent>

        <TabsContent value="dev-tools">
          <AdminDevToolsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
