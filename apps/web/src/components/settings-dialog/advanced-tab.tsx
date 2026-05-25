import { useMutation } from "@tanstack/react-query"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { downloadMyBuildsExport } from "@/lib/queries/me-query"
import { authorName } from "@/lib/util/user-display"

import { extras, SignedOutNotice } from "./shared"

export function AdvancedPanel() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  const exportAction = useMutation({ mutationFn: downloadMyBuildsExport })
  const revokeAction = useMutation({
    mutationFn: async () => {
      const res = await authClient.revokeOtherSessions()
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to revoke sessions.")
      }
    },
  })

  const [deleteOpen, setDeleteOpen] = React.useState(false)

  if (!user) {
    return <SignedOutNotice message="Sign in to access advanced settings." />
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Export my builds</FieldLabel>
        <FieldDescription>
          Download every build you've created as a single JSON file.
        </FieldDescription>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => exportAction.mutate()}
            disabled={exportAction.isPending}
          >
            {exportAction.isPending ? "Preparing…" : "Download JSON"}
          </Button>
          {exportAction.error ? (
            <span className="text-destructive text-sm">
              {exportAction.error.message}
            </span>
          ) : null}
        </div>
      </Field>

      <Field>
        <FieldLabel>Sign out other sessions</FieldLabel>
        <FieldDescription>
          Signs out every other browser and device. Your current session stays
          active.
        </FieldDescription>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => revokeAction.mutate()}
            disabled={revokeAction.isPending}
          >
            {revokeAction.isPending
              ? "Signing out…"
              : "Sign out other sessions"}
          </Button>
          {revokeAction.isSuccess ? (
            <span className="text-muted-foreground text-sm">
              Other sessions signed out.
            </span>
          ) : revokeAction.error ? (
            <span className="text-destructive text-sm">
              {revokeAction.error.message}
            </span>
          ) : null}
        </div>
      </Field>

      <Field>
        <FieldLabel className="text-destructive">Delete account</FieldLabel>
        <FieldDescription>
          Permanently deletes your account, builds, likes, and bookmarks. This
          cannot be undone.
        </FieldDescription>
        <div className="pt-1">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete account…
          </Button>
        </div>
      </Field>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        expected={authorName(extras(user), user.email)}
      />
    </FieldGroup>
  )
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  expected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expected: string
}) {
  const [value, setValue] = React.useState("")
  const del = useMutation({
    mutationFn: async () => {
      const res = await authClient.deleteUser()
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to delete account.")
      }
    },
    onSuccess: () => {
      window.location.href = "/"
    },
  })

  React.useEffect(() => {
    if (!open) {
      setValue("")
      del.reset()
    }
  }, [open, del])

  const confirmed = value === expected

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogTitle>Delete account</DialogTitle>
        <DialogDescription>
          This permanently deletes your account and every build, like, and
          bookmark tied to it. Type{" "}
          <code className="font-mono">{expected}</code> to confirm.
        </DialogDescription>
        <div className="flex flex-col gap-3 pt-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={expected}
            autoComplete="off"
          />
          {del.error ? (
            <p className="text-destructive text-sm">{del.error.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!confirmed || del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
