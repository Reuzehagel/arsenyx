import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getAdminStats,
  getTopBuilds,
  getTopUsers,
  getRecentUsers,
} from "@/lib/db/admin"

export async function AdminStatsTab() {
  const [stats, topBuilds, topUsers, recentUsers] = await Promise.all([
    getAdminStats(),
    getTopBuilds(10),
    getTopUsers(10),
    getRecentUsers(10),
  ])

  return (
    <div className="flex flex-col gap-8 pt-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Total Builds" value={stats.totalBuilds} />
        <StatCard label="Today" value={stats.buildsToday} />
        <StatCard label="This Week" value={stats.buildsThisWeek} />
        <StatCard label="This Month" value={stats.buildsThisMonth} />
      </div>

      {/* Builds by Category */}
      <section>
        <h3 className="mb-2 text-sm font-medium">Builds by Category</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.buildsByCategory.map((cat) => (
              <TableRow key={cat.itemCategory}>
                <TableCell className="capitalize">
                  {cat.itemCategory}
                </TableCell>
                <TableCell>{cat._count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Top Builds */}
        <section>
          <h3 className="mb-2 text-sm font-medium">Top Builds (by votes)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Build</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Votes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topBuilds.map((build) => (
                <TableRow key={build.id}>
                  <TableCell className="font-medium">{build.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {build.itemName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {build.user.username || build.user.name || "—"}
                  </TableCell>
                  <TableCell>{build.voteCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {/* Top Users */}
        <section>
          <h3 className="mb-2 text-sm font-medium">
            Most Active Users (by builds)
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Builds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.username || user.name || "—"}
                  </TableCell>
                  <TableCell>{user._count.builds}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      {/* Recent Signups */}
      <section>
        <h3 className="mb-2 text-sm font-medium">Recent Signups</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.username || user.name || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.createdAt.toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  )
}
