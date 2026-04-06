"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  adminUpdateUserRoleAction,
  adminBanUserAction,
  adminUnbanUserAction,
  adminDeleteUserAction,
} from "@/app/actions/admin"
import { AdminDeleteDialog } from "@/components/admin/admin-delete-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { AdminUser } from "@/lib/db/admin"

interface AdminUserActionsProps {
  user: AdminUser
  currentUserId: string
}

export function AdminUserActions({
  user,
  currentUserId,
}: AdminUserActionsProps) {
  const router = useRouter()
  const isSelf = user.id === currentUserId

  async function toggleRole(
    flag: "isVerified" | "isCommunityLeader" | "isModerator" | "isAdmin",
    value: boolean,
  ) {
    const result = await adminUpdateUserRoleAction(user.id, { [flag]: value })
    if (result.success) {
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleBan() {
    const result = user.isBanned
      ? await adminUnbanUserAction(user.id)
      : await adminBanUserAction(user.id)
    if (result.success) {
      toast.success(user.isBanned ? "User unbanned" : "User banned")
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDelete() {
    const result = await adminDeleteUserAction(user.id)
    if (result.success) {
      toast.success("User deleted")
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            size="sm"
            checked={user.isVerified}
            onCheckedChange={(v) => toggleRole("isVerified", v)}
          />
          Verified
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            size="sm"
            checked={user.isCommunityLeader}
            onCheckedChange={(v) => toggleRole("isCommunityLeader", v)}
          />
          CL
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            size="sm"
            checked={user.isModerator}
            onCheckedChange={(v) => toggleRole("isModerator", v)}
          />
          Mod
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            size="sm"
            checked={user.isAdmin}
            onCheckedChange={(v) => toggleRole("isAdmin", v)}
            disabled={isSelf}
          />
          Admin
        </label>
      </div>
      <Button
        variant={user.isBanned ? "outline" : "destructive"}
        size="sm"
        onClick={handleBan}
        disabled={isSelf}
      >
        {user.isBanned ? "Unban" : "Ban"}
      </Button>
      <AdminDeleteDialog
        title={`Delete ${user.name || user.username || "user"}?`}
        description="This will anonymize the user profile and permanently delete all their builds, votes, and favorites. This cannot be undone."
        onConfirm={handleDelete}
        trigger={
          <Button variant="ghost" size="sm" disabled={isSelf}>
            Delete
          </Button>
        }
      />
    </div>
  )
}
