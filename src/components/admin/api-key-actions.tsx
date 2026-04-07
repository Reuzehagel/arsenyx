"use client"

import { Button } from "@/components/ui/button"
import {
  toggleApiKeyAction,
  deleteApiKeyAction,
} from "@/app/admin/api-keys/actions"

interface ApiKeyActionsProps {
  id: string
  isActive: boolean
}

export function ApiKeyActions({ id, isActive }: ApiKeyActionsProps) {
  return (
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleApiKeyAction(id, !isActive)}
      >
        {isActive ? "Revoke" : "Activate"}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          if (confirm("Permanently delete this API key?")) {
            deleteApiKeyAction(id)
          }
        }}
      >
        Delete
      </Button>
    </div>
  )
}
