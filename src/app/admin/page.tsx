import { notFound } from "next/navigation"

import { AdminApiKeysTab } from "@/components/admin/admin-api-keys-tab"
import { AdminContentTab } from "@/components/admin/admin-content-tab"
import { AdminDevToolsTab } from "@/components/admin/admin-dev-tools-tab"
import { AdminStatsTab } from "@/components/admin/admin-stats-tab"
import { AdminUsersTab } from "@/components/admin/admin-users-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getServerSession } from "@/lib/auth"

export const metadata = { title: "Admin | ARSENYX" }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>
}) {
  const session = await getServerSession()
  if (!session?.user?.isAdmin) notFound()

  const { tab = "users", q } = await searchParams

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Admin Panel</h1>
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="dev-tools">Dev Tools</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsersTab search={q} currentUserId={session.user.id} />
        </TabsContent>

        <TabsContent value="content">
          <AdminContentTab search={q} />
        </TabsContent>

        <TabsContent value="stats">
          <AdminStatsTab />
        </TabsContent>

        <TabsContent value="dev-tools">
          <AdminDevToolsTab />
        </TabsContent>

        <TabsContent value="api-keys">
          <AdminApiKeysTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
