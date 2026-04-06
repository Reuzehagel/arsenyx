import Image from "next/image"

import { AdminUserActions } from "@/components/admin/admin-user-actions"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminUsers } from "@/lib/db/admin"

interface AdminUsersTabProps {
  search?: string
  currentUserId: string
}

export async function AdminUsersTab({ search, currentUserId }: AdminUsersTabProps) {
  const users = await getAdminUsers(search)

  return (
    <div className="space-y-4 pt-4">
      <form action="/admin" className="flex gap-2">
        <input type="hidden" name="tab" value="users" />
        <Input
          name="q"
          placeholder="Search users..."
          defaultValue={search}
          className="max-w-sm"
        />
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Builds</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="bg-muted size-6 rounded-full" />
                  )}
                  <span className="font-medium">
                    {user.displayUsername || user.name || "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.email}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {user.isAdmin && <Badge variant="default">Admin</Badge>}
                  {user.isModerator && <Badge variant="secondary">Mod</Badge>}
                  {user.isCommunityLeader && (
                    <Badge variant="secondary">CL</Badge>
                  )}
                  {user.isVerified && <Badge variant="outline">Verified</Badge>}
                  {user.isBanned && (
                    <Badge variant="destructive">Banned</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{user._count.builds}</TableCell>
              <TableCell className="text-muted-foreground">
                {user.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell>
                <AdminUserActions
                  user={user}
                  currentUserId={currentUserId}
                />
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
