import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/**
 * Twin-frames (Sirius & Orion): the top-level form switcher rendered above the
 * variant tabs in both the editor (`EditorVariantBar`) and the read-only viewer
 * (`VariantTabs`). Single-select; clicking the active form (which would
 * deselect → empty value) is ignored.
 */
export function FormToggle({
  formNames,
  activeFormIndex,
  onSelect,
}: {
  formNames: string[]
  activeFormIndex: number
  onSelect: (formIndex: number) => void
}) {
  return (
    <ToggleGroup
      value={[String(activeFormIndex)]}
      onValueChange={(value) => {
        const next = Number(value[0])
        if (Number.isInteger(next) && next >= 0 && next < formNames.length) {
          onSelect(next)
        }
      }}
      variant="outline"
      spacing={0}
      aria-label="Frame form"
    >
      {formNames.map((fname, fi) => (
        <ToggleGroupItem
          key={fi}
          value={String(fi)}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary px-4"
        >
          {fname}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
