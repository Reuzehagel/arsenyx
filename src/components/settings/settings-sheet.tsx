"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  getSettingsDataAction,
  updateProfileAction,
} from "@/app/actions/profile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UserData {
  username: string
  displayUsername: string | null
  image: string | null
  bio: string | null
  email: string
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Fetch user data when sheet opens
  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    setError(null)
    getSettingsDataAction().then((result) => {
      if (result.success) {
        const user = result.data
        setUserData({
          username: user.username ?? "",
          displayUsername: user.displayUsername,
          image: user.image,
          bio: user.bio,
          email: user.email,
        })
        setUsername(user.displayUsername ?? user.username ?? "")
        setBio(user.bio ?? "")
      }
      setIsLoading(false)
    })
  }, [open])

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
      onOpenChange(false)
    } else {
      setError(result.error)
      toast.error(result.error)
    }
  }

  const usernameError = error?.toLowerCase().includes("username") ? error : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Profile Settings</SheetTitle>
          <SheetDescription>
            Update your public profile information
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4">
          {isLoading || !userData ? (
            <div className="flex flex-col gap-5">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (
            <form id="settings-form" onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Avatar</FieldLabel>
                  <div className="flex items-center gap-4">
                    <Avatar className="size-14">
                      <AvatarImage
                        src={userData.image ?? undefined}
                        alt={userData.username ?? "Avatar"}
                      />
                      <AvatarFallback>
                        {(userData.displayUsername ??
                          userData.username ??
                          "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <FieldDescription>
                      Synced from your GitHub account
                    </FieldDescription>
                  </div>
                </Field>

                <Field data-invalid={usernameError ? true : undefined}>
                  <FieldLabel htmlFor="settings-username">Username</FieldLabel>
                  <Input
                    id="settings-username"
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
                  <FieldLabel htmlFor="settings-bio">Bio</FieldLabel>
                  <Textarea
                    id="settings-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell others about yourself…"
                    maxLength={300}
                    rows={3}
                  />
                  <FieldDescription>{bio.length}/300</FieldDescription>
                </Field>

                <Field data-disabled>
                  <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                  <Input id="settings-email" value={userData.email} disabled />
                  <FieldDescription>
                    Managed by your GitHub account
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </ScrollArea>
        <SheetFooter>
          <Button
            type="submit"
            form="settings-form"
            disabled={isPending || isLoading}
          >
            {isPending && <Spinner />}
            Save Changes
          </Button>
          <SheetClose render={<Button variant="outline" />}>
            Cancel
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
