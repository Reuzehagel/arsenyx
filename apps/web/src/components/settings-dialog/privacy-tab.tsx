import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { authClient } from "@/lib/auth-client"

import { type BuildVisibility, extras, SignedOutNotice } from "./shared"

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: BuildVisibility
  label: string
  description: string
}> = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Listed on the browse page and your profile.",
  },
  {
    value: "UNLISTED",
    label: "Unlisted",
    description: "Accessible by link, but not listed publicly.",
  },
  {
    value: "PRIVATE",
    label: "Private",
    description: "Only visible to you.",
  },
]

export function PrivacyPanel() {
  const { data: session } = authClient.useSession()
  const user = session?.user
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: async (visibility: BuildVisibility) => {
      const res = await authClient.updateUser({
        defaultBuildVisibility: visibility,
      } as Parameters<typeof authClient.updateUser>[0])
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to update preference.")
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })

  if (!user) {
    return <SignedOutNotice message="Sign in to manage privacy preferences." />
  }

  const current = extras(user).defaultBuildVisibility ?? "PUBLIC"
  const effective = update.isPending ? update.variables : current

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="default-visibility">
          Default build visibility
        </FieldLabel>
        <FieldDescription>
          Visibility applied when you create a new build without choosing one.
          Existing builds aren't changed.
        </FieldDescription>
        <Select
          items={VISIBILITY_OPTIONS}
          value={effective}
          onValueChange={(v) => {
            if (v && v !== current) update.mutate(v as BuildVisibility)
          }}
        >
          <SelectTrigger id="default-visibility" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {VISIBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{o.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {o.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {update.error ? (
          <p className="text-destructive text-sm">{update.error.message}</p>
        ) : null}
      </Field>
    </FieldGroup>
  )
}
