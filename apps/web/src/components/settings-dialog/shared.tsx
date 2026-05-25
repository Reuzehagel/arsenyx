import { Field, FieldDescription, FieldGroup } from "@/components/ui/field"
import type { BuildDetail } from "@/lib/build-query"

export type BuildVisibility = BuildDetail["visibility"]

export type SessionUserExtras = {
  displayUsername: string | null
  username: string | null
  defaultBuildVisibility: BuildVisibility
}

export function extras(user: object): SessionUserExtras {
  return user as SessionUserExtras
}

export function SignedOutNotice({ message }: { message: string }) {
  return (
    <FieldGroup>
      <Field>
        <FieldDescription>{message}</FieldDescription>
      </Field>
    </FieldGroup>
  )
}
