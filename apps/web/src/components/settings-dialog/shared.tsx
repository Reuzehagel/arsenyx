import { Field, FieldDescription, FieldGroup } from "@/components/ui/field"

export function SignedOutNotice({ message }: { message: string }) {
  return (
    <FieldGroup>
      <Field>
        <FieldDescription>{message}</FieldDescription>
      </Field>
    </FieldGroup>
  )
}
