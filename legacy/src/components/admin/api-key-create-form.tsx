"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Result } from "@/lib/result"

import { createApiKeyAction } from "@/app/admin/api-keys/actions"

const SCOPE_OPTIONS = [
  { label: "image:generate", value: "image:generate" },
  { label: "build:read", value: "build:read" },
  { label: "build:write", value: "build:write" },
]

const EXPIRY_OPTIONS = [
  { label: "Never", value: "never" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "1 year", value: "1y" },
]

export function ApiKeyCreateForm() {
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "image:generate",
  ])
  const [selectedExpiry, setSelectedExpiry] = useState("never")

  async function handleSubmit(
    _prev: Result<{ rawKey: string; prefix: string }> | null,
    formData: FormData,
  ) {
    formData.set("scopes", selectedScopes.join(","))
    formData.set("expiresIn", selectedExpiry)
    const result = await createApiKeyAction(formData)
    if (result.success) {
      setCreatedKey(result.data.rawKey)
    }
    return result
  }

  const [state, action, pending] = useActionState(handleSubmit, null)

  return (
    <section className="flex flex-col gap-4">
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
        <Field>
          <FieldLabel htmlFor="key-name">Name</FieldLabel>
          <Input
            id="key-name"
            name="name"
            placeholder="Profit-Taker Wiki"
            required
          />
        </Field>

        <Field>
          <FieldLabel>Scopes</FieldLabel>
          <Select
            items={SCOPE_OPTIONS}
            multiple
            defaultValue={["image:generate"]}
            onValueChange={(value: string[]) => setSelectedScopes(value)}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue>
                {(value: string[]) => {
                  if (value.length === 0) return "Select scopes"
                  if (value.length === 1) return value[0]
                  return `${value.length} scopes`
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="key-rate-limit">Rate Limit (/hr)</FieldLabel>
          <Input
            id="key-rate-limit"
            name="rateLimit"
            type="number"
            defaultValue="60"
          />
        </Field>

        <Field>
          <FieldLabel>Expires</FieldLabel>
          <Select
            items={EXPIRY_OPTIONS}
            defaultValue="never"
            onValueChange={(value: string | null) =>
              setSelectedExpiry(value ?? "never")
            }
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Key"}
        </Button>
      </form>
    </section>
  )
}
