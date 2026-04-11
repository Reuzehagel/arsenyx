"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { adminDeleteOrganizationAction } from "@/app/actions/admin"
import { AdminDeleteDialog } from "@/components/admin/admin-delete-dialog"

interface AdminCommunityActionsProps {
  orgId: string
  orgName: string
}

export function AdminCommunityActions({
  orgId,
  orgName,
}: AdminCommunityActionsProps) {
  const router = useRouter()

  return (
    <AdminDeleteDialog
      title={`Delete "${orgName}"?`}
      description="This will permanently delete this community and remove all member associations. Builds owned by this community will be unlinked but not deleted. This cannot be undone."
      onConfirm={async () => {
        const result = await adminDeleteOrganizationAction(orgId)
        if (result.success) {
          toast.success("Community deleted")
          router.refresh()
        } else {
          toast.error(result.error)
        }
      }}
    />
  )
}
