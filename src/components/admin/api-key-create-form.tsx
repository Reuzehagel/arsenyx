"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Result } from "@/lib/result"

import { createApiKeyAction } from "@/app/admin/api-keys/actions"

export function ApiKeyCreateForm() {
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  async function handleSubmit(
    _prev: Result<{ rawKey: string; prefix: string }> | null,
    formData: FormData,
  ) {
    const result = await createApiKeyAction(formData)
    if (result.success) {
      setCreatedKey(result.data.rawKey)
    }
    return result
  }

  const [state, action, pending] = useActionState(handleSubmit, null)

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">Create API Key</h3>

      {createdKey && (
        <div className="bg-card rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium text-green-500">
            Key created! Copy it now — it won't be shown again:
          </p>
          <code className="bg-muted block rounded p-2 text-sm break-all">
            {createdKey}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              navigator.clipboard.writeText(createdKey)
            }}
          >
            Copy to clipboard
          </Button>
        </div>
      )}

      {state && !state.success && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}

      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="key-name">Name</Label>
          <Input
            id="key-name"
            name="name"
            placeholder="Profit-Taker Wiki"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="key-scopes">Scopes</Label>
          <Input
            id="key-scopes"
            name="scopes"
            defaultValue="image:generate"
            placeholder="image:generate"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="key-rate-limit">Rate Limit (/hr)</Label>
          <Input
            id="key-rate-limit"
            name="rateLimit"
            type="number"
            defaultValue="100"
          />
        </div>

        <div className="space-y-1">
          <Label>Expires</Label>
          <Select name="expiresIn" defaultValue="never">
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="1y">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Key"}
        </Button>
      </form>
    </section>
  )
}
