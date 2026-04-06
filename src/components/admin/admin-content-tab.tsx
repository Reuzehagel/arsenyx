"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { adminDeleteBuildAction } from "@/app/actions/admin"
import { AdminDeleteDialog } from "@/components/admin/admin-delete-dialog"
import { Button } from "@/components/ui/button"
import type { AdminBuild } from "@/lib/db/admin"

interface AdminContentTableProps {
  builds: AdminBuild[]
}

export function AdminContentTable({ builds }: AdminContentTableProps) {
  const router = useRouter()

  if (builds.length === 0) {
    return (
      <tr>
        <td
          colSpan={8}
          className="text-muted-foreground h-24 p-2 text-center"
        >
          No builds found.
        </td>
      </tr>
    )
  }

  return (
    <>
      {builds.map((build) => (
        <tr
          key={build.id}
          className="hover:bg-muted/50 border-b transition-colors"
        >
          <td className="p-2 align-middle whitespace-nowrap font-medium">
            {build.name}
          </td>
          <td className="text-muted-foreground p-2 align-middle whitespace-nowrap">
            {build.user.username || build.user.name || "—"}
          </td>
          <td className="text-muted-foreground p-2 align-middle whitespace-nowrap capitalize">
            {build.itemCategory}
          </td>
          <td className="p-2 align-middle whitespace-nowrap">
            {build.itemName}
          </td>
          <td className="p-2 align-middle whitespace-nowrap">
            {build.voteCount}
          </td>
          <td className="p-2 align-middle whitespace-nowrap">
            {build.favoriteCount}
          </td>
          <td className="text-muted-foreground p-2 align-middle whitespace-nowrap">
            {new Date(build.createdAt).toLocaleDateString()}
          </td>
          <td className="p-2 align-middle whitespace-nowrap">
            <AdminDeleteDialog
              title={`Delete "${build.name}"?`}
              description="This will permanently delete this build and all its votes, favorites, and guide content. This cannot be undone."
              onConfirm={async () => {
                const result = await adminDeleteBuildAction(build.id)
                if (result.success) {
                  toast.success("Build deleted")
                  router.refresh()
                } else {
                  toast.error(result.error)
                }
              }}
              trigger={
                <Button variant="ghost" size="sm">
                  Delete
                </Button>
              }
            />
          </td>
        </tr>
      ))}
    </>
  )
}
