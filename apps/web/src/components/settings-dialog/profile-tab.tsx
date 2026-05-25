import { useMutation, useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import { authClient } from "@/lib/auth-client"

import { extras, SignedOutNotice } from "./shared"

export function ProfilePanel() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  if (!user) {
    return <SignedOutNotice message="Sign in to edit your profile." />
  }

  return <ProfileForm key={user.id} user={user} />
}

function ProfileForm({
  user,
}: {
  user: NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"]
}) {
  const queryClient = useQueryClient()
  const initial = extras(user).displayUsername ?? extras(user).username ?? ""
  const [displayUsername, setDisplayUsername] = React.useState(initial)

  const save = useMutation({
    mutationFn: async (next: string) => {
      const res = await authClient.updateUser({ displayUsername: next })
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to update profile.")
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })

  const trimmed = displayUsername.trim()
  const currentUsername = extras(user).username
  const dirty = trimmed !== initial.trim() && trimmed.length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty) save.mutate(trimmed)
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>Account</FieldLabel>
          <FieldDescription>
            Your name and avatar are synced from GitHub.
          </FieldDescription>
          <div className="flex items-center gap-3 pt-1">
            <UserAvatar
              src={user.image ?? null}
              fallback={user.name || user.email}
              size={10}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {user.email}
              </span>
            </div>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="display-username">Display username</FieldLabel>
          <FieldDescription>
            Shown on your builds and profile. Your handle
            {currentUsername ? ` (@${currentUsername})` : ""} stays the same.
          </FieldDescription>
          <Input
            id="display-username"
            value={displayUsername}
            onChange={(e) => setDisplayUsername(e.target.value)}
            maxLength={50}
            placeholder={currentUsername ?? "Display name"}
          />
        </Field>
        {save.error ? (
          <p className="text-destructive text-sm">{save.error.message}</p>
        ) : save.isSuccess ? (
          <p className="text-muted-foreground text-sm">Saved.</p>
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
