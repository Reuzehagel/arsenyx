"use client"

import { useState } from "react"
import { toast } from "sonner"

import { updateProfileAction } from "@/app/actions/profile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { UserProfileFull } from "@/lib/db/index"

interface SettingsFormProps {
  user: UserProfileFull
}

export function SettingsForm({ user }: SettingsFormProps) {
  const [username, setUsername] = useState(
    user.displayUsername ?? user.username ?? "",
  )
  const [bio, setBio] = useState(user.bio ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await updateProfileAction({
      username: username.trim(),
      bio: bio.trim(),
    })

    setIsPending(false)

    if (result.success) {
      toast.success("Profile updated")
    } else {
      setError(result.error)
      toast.error(result.error)
    }
  }

  const usernameError = error?.toLowerCase().includes("username") ? error : null

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your public profile information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Avatar</FieldLabel>
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage
                    src={user.image ?? undefined}
                    alt={user.username ?? "Avatar"}
                  />
                  <AvatarFallback>
                    {(user.displayUsername ??
                      user.username ??
                      "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <FieldDescription>
                  Synced from your GitHub account
                </FieldDescription>
              </div>
            </Field>

            <Field data-invalid={usernameError ? true : undefined}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username…"
                autoComplete="username"
                spellCheck={false}
                minLength={3}
                maxLength={20}
                aria-invalid={usernameError ? true : undefined}
              />
              <FieldDescription>
                3-20 characters. Letters, numbers, hyphens, and underscores
                only.
              </FieldDescription>
              {usernameError && <FieldError>{usernameError}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="bio">Bio</FieldLabel>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself…"
                maxLength={300}
                rows={3}
              />
              <FieldDescription>{bio.length}/300</FieldDescription>
            </Field>

            <Field data-disabled>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={user.email} disabled />
              <FieldDescription>
                Managed by your GitHub account
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
