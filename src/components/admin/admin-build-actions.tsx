"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { adminDeleteBuildAction } from "@/app/actions/admin"
import { AdminDeleteDialog } from "@/components/admin/admin-delete-dialog"

interface AdminBuildActionsProps {
  buildId: string
  buildName: string
}

export function AdminBuildActions({
  buildId,
  buildName,
}: AdminBuildActionsProps) {
  const router = useRouter()

  return (
    <AdminDeleteDialog
      title={`Delete "${buildName}"?`}
      description="This will permanently delete this build and all its votes, favorites, and guide content. This cannot be undone."
      onConfirm={async () => {
        const result = await adminDeleteBuildAction(buildId)
        if (result.success) {
          toast.success("Build deleted")
          router.refresh()
        } else {
          toast.error(result.error)
        }
      }}
    />
  )
}
