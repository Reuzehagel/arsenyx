import { useTheme } from "@/components/theme-provider"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const THEMES = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
  { value: "system" as const, label: "System" },
]

export function AppearancePanel() {
  const { theme, setTheme } = useTheme()
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Theme</FieldLabel>
        <FieldDescription>
          Choose how Arsenyx looks. System follows your OS preference.
        </FieldDescription>
        <ToggleGroup
          value={[theme]}
          onValueChange={(value) => {
            const next = value[0]
            if (next === "light" || next === "dark" || next === "system")
              setTheme(next)
          }}
          variant="outline"
          size="sm"
          spacing={0}
          className="mt-1"
        >
          {THEMES.map((t) => (
            <ToggleGroupItem key={t.value} value={t.value}>
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    </FieldGroup>
  )
}
