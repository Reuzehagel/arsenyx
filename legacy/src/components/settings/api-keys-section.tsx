"use client"

import { Copy, KeyRound, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  createApiKeyAction,
  listApiKeysAction,
  revokeApiKeyAction,
  type CreateApiKeyActionResult,
} from "@/app/actions/api-keys"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { ApiKeyListItem } from "@/lib/db/api-keys"

interface ApiKeysSectionProps {
  open: boolean
}

type ExpiryPreset = "never" | "30d" | "90d" | "1y"

const EXPIRY_OPTIONS: { value: ExpiryPreset; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
]

function formatDate(value: Date | string | null): string {
  if (!value) return "Never"
  return new Date(value).toLocaleString()
}

export function ApiKeysSection({ open }: ApiKeysSectionProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeyListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("never")
  const [isCreating, setIsCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<CreateApiKeyActionResult | null>(
    null,
  )

  useEffect(() => {
    if (!open) return

    setIsLoading(true)
    listApiKeysAction()
      .then((result) => {
        if (result.success) {
          setApiKeys(result.data)
        } else {
          toast.error(result.error)
        }
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [open])

  const activeKeyCount = useMemo(
    () => apiKeys.filter((apiKey) => apiKey.isActive).length,
    [apiKeys],
  )

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Token name is required")
      return
    }

    setIsCreating(true)
    const result = await createApiKeyAction({
      name: name.trim(),
      expiresIn: expiryPreset,
    })
    setIsCreating(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setName("")
    setExpiryPreset("never")
    setCreatedKey(result.data)
    setApiKeys((prev) => [result.data.apiKey, ...prev])
  }

  async function handleRevoke(apiKeyId: string) {
    setRevokingId(apiKeyId)
    const result = await revokeApiKeyAction(apiKeyId)
    setRevokingId(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setApiKeys((prev) =>
      prev.map((apiKey) =>
        apiKey.id === apiKeyId ? { ...apiKey, isActive: false } : apiKey,
      ),
    )
  }

  async function handleCopyToken() {
    if (!createdKey?.token) return

    try {
      await navigator.clipboard.writeText(createdKey.token)
      toast.success("Token copied")
    } catch {
      toast.error("Failed to copy token")
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">API Tokens</span>
          <span className="text-muted-foreground text-xs">
            Personal access tokens for `build:write` automation. Active keys:{" "}
            {activeKeyCount}/10.
          </span>
        </div>

        <div className="rounded-lg border p-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="api-key-name">Token name</FieldLabel>
              <Input
                id="api-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Discord bot, CI uploader, local script…"
                maxLength={100}
              />
              <FieldDescription>
                Use a label that will still make sense later.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Expires</FieldLabel>
              <Select
                value={expiryPreset}
                onValueChange={(value) =>
                  setExpiryPreset(value as ExpiryPreset)
                }
                items={EXPIRY_OPTIONS}
              >
                <SelectTrigger className="w-full">
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
          </FieldGroup>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
            >
              <KeyRound data-icon="inline-start" />
              Create Token
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </>
          ) : apiKeys.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              No API tokens yet.
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {apiKey.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {apiKey.keyPrefix}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-3 text-xs">
                      <span>Scopes: {apiKey.scopes.join(", ")}</span>
                      <span>Created: {formatDate(apiKey.createdAt)}</span>
                      <span>Last used: {formatDate(apiKey.lastUsedAt)}</span>
                      <span>Expires: {formatDate(apiKey.expiresAt)}</span>
                      <span>{apiKey.isActive ? "Active" : "Revoked"}</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevoke(apiKey.id)}
                    disabled={!apiKey.isActive || revokingId === apiKey.id}
                  >
                    <Trash2 data-icon="inline-start" />
                    Revoke
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog
        open={createdKey !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCreatedKey(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token Created</DialogTitle>
            <DialogDescription>
              This token is shown once. Store it now.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted rounded-md p-3">
            <code className="text-sm break-all">{createdKey?.token}</code>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCopyToken}>
              <Copy data-icon="inline-start" />
              Copy
            </Button>
            <Button type="button" onClick={() => setCreatedKey(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
