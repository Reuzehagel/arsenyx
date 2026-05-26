import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { authClient } from "@/lib/auth-client"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import {
  type ApiKeySummary,
  createApiKey,
  myApiKeysQuery,
  revokeApiKey,
} from "@/lib/queries/me-query"

import { SignedOutNotice } from "./shared"

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
] as const

type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]["value"]

function expiryToDate(v: ExpiryValue): string | null {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  switch (v) {
    case "never":
      return null
    case "30d":
      return new Date(now + 30 * day).toISOString()
    case "90d":
      return new Date(now + 90 * day).toISOString()
    case "1y":
      return new Date(now + 365 * day).toISOString()
  }
}

function formatDate(iso: string | null, fallback = "Never") {
  if (!iso) return fallback
  return new Date(iso).toLocaleDateString()
}

type ScopeOption = {
  value: string
  label: string
  description: string
  privileged?: boolean
}

const SCOPE_OPTIONS: readonly ScopeOption[] = [
  {
    value: "build:read",
    label: "build:read",
    description: "Read public builds via /api/v1",
  },
  {
    value: "build:write",
    label: "build:write",
    description: "Import builds (/api/v1/imports/overframe)",
  },
]

const DEFAULT_SCOPES = SCOPE_OPTIONS.filter((s) => !s.privileged).map(
  (s) => s.value,
)

export function ApiKeysPanel() {
  const { data: session } = authClient.useSession()
  const signedIn = !!session?.user

  const keysQuery = useQuery({ ...myApiKeysQuery(), enabled: signedIn })

  if (!signedIn) {
    return <SignedOutNotice message="Sign in to manage API keys." />
  }

  const keys = keysQuery.data?.apiKeys ?? []
  const activeCount = keys.filter((k) => k.isActive).length

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>API keys</FieldLabel>
        <FieldDescription>
          Authenticate the Arsenyx public API from scripts or tools. Keys are
          shown once on creation — store them somewhere safe.
        </FieldDescription>
      </Field>

      <CreateApiKeyForm disabled={activeCount >= 10} />

      {keysQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No API keys yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k) => (
            <ApiKeyRow key={k.id} apiKey={k} />
          ))}
        </div>
      )}
    </FieldGroup>
  )
}

function CreateApiKeyForm({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const user = session?.user as
    | { isAdmin?: boolean; isModerator?: boolean }
    | undefined
  const canUsePrivileged = user?.isAdmin === true || user?.isModerator === true

  const [name, setName] = React.useState("")
  const [expiry, setExpiry] = React.useState<ExpiryValue>("never")
  const [scopes, setScopes] = React.useState<Set<string>>(
    () => new Set(DEFAULT_SCOPES),
  )
  const [justCreated, setJustCreated] = React.useState<{
    token: string
    apiKey: ApiKeySummary
  } | null>(null)
  const { copied, copy } = useCopyToClipboard()

  const toggleScope = (scope: string) => {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  const create = useMutation({
    mutationFn: () =>
      createApiKey({
        name: name.trim(),
        expiresAt: expiryToDate(expiry),
        scopes: Array.from(scopes),
      }),
    onSuccess: (data) => {
      setJustCreated(data)
      setName("")
      setExpiry("never")
      setScopes(new Set(DEFAULT_SCOPES))
      void queryClient.invalidateQueries({ queryKey: ["me", "api-keys"] })
    },
  })

  if (justCreated) {
    return (
      <Field>
        <FieldLabel>New API key</FieldLabel>
        <FieldDescription>
          Copy this key now. You won't be able to see it again.
        </FieldDescription>
        <div className="bg-muted/40 flex items-center gap-2 rounded-md border p-2">
          <code className="flex-1 truncate font-mono text-xs">
            {justCreated.token}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copy(justCreated.token)}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="pt-1">
          <Button type="button" size="sm" onClick={() => setJustCreated(null)}>
            Done
          </Button>
        </div>
      </Field>
    )
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || create.isPending || disabled) return
        create.mutate()
      }}
    >
      <Field>
        <FieldLabel htmlFor="new-api-key-name">Create API key</FieldLabel>
        <FieldDescription>
          A human-friendly label so you remember what this key is for.
        </FieldDescription>
        <Input
          id="new-api-key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CI import script"
          maxLength={100}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-api-key-expiry">Expires</FieldLabel>
        <Select
          items={EXPIRY_OPTIONS}
          value={expiry}
          onValueChange={(v) => {
            if (v) setExpiry(v as ExpiryValue)
          }}
        >
          <SelectTrigger id="new-api-key-expiry" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Scopes</FieldLabel>
        <FieldDescription>
          Controls which endpoints this key can access.
        </FieldDescription>
        <div className="flex flex-col gap-1.5">
          {SCOPE_OPTIONS.filter((s) => !s.privileged || canUsePrivileged).map(
            (s) => (
              <ScopeCheckbox
                key={s.value}
                id={`scope-${s.value}`}
                label={s.label}
                description={s.description}
                checked={scopes.has(s.value)}
                onChange={() => toggleScope(s.value)}
              />
            ),
          )}
        </div>
      </Field>
      {create.error ? (
        <p className="text-destructive text-sm">{create.error.message}</p>
      ) : disabled ? (
        <p className="text-muted-foreground text-sm">
          You've reached the 10 active key limit. Revoke one to create another.
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          size="sm"
          disabled={
            !name.trim() || create.isPending || disabled || scopes.size === 0
          }
        >
          {create.isPending ? "Creating…" : "Create key"}
        </Button>
      </div>
    </form>
  )
}

function ScopeCheckbox({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-md p-1.5"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <div className="flex flex-col">
        <code className="font-mono text-xs">{label}</code>
        <span className="text-muted-foreground text-xs">{description}</span>
      </div>
    </label>
  )
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKeySummary }) {
  const queryClient = useQueryClient()
  const revoke = useMutation({
    mutationFn: () => revokeApiKey(apiKey.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me", "api-keys"] })
    },
  })

  const onRevoke = () => {
    if (!window.confirm(`Revoke "${apiKey.name}"? This cannot be undone.`)) {
      return
    }
    revoke.mutate()
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{apiKey.name}</span>
          {!apiKey.isActive ? (
            <span className="text-muted-foreground text-xs">(revoked)</span>
          ) : null}
        </div>
        <code className="text-muted-foreground truncate font-mono text-xs">
          {apiKey.keyPrefix}…
        </code>
        <span className="text-muted-foreground text-xs">
          Created {formatDate(apiKey.createdAt)} · Expires{" "}
          {formatDate(apiKey.expiresAt)} · Last used{" "}
          {formatDate(apiKey.lastUsedAt)} · {apiKey.rateLimit}/min
        </span>
      </div>
      {apiKey.isActive ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRevoke}
          disabled={revoke.isPending}
        >
          {revoke.isPending ? "Revoking…" : "Revoke"}
        </Button>
      ) : null}
    </div>
  )
}
