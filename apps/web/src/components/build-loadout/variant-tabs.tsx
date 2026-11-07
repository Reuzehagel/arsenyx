import { FormToggle } from "@/components/form-toggle"
import { variantDisplayLabel } from "@/lib/build/variants"

import { VARIANT_TRACK, VariantTab } from "./variant-tab"

/**
 * Read-only tab bar for switching between a build's variants in the
 * viewer. Shares the `VariantTab` styling with `EditorVariantBar` (active =
 * primary fill) without the settings popover or add/duplicate/delete
 * affordances.
 */
export function VariantTabs({
  variants,
  activeIndex,
  onSelect,
  formNames,
  activeFormIndex = 0,
  onSelectForm,
  note,
}: {
  /** Small line under the tabs, e.g. that variants differ in forma. */
  note?: string
  variants: { id: string; label: string }[]
  activeIndex: number
  onSelect: (index: number) => void
  /** Twin-frames (Sirius & Orion): switchable form names. When present a form
   *  toggle renders above the (form-filtered) variant tabs. */
  formNames?: string[]
  activeFormIndex?: number
  onSelectForm?: (formIndex: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 pb-2">
      {formNames && onSelectForm ? (
        <FormToggle
          formNames={formNames}
          activeFormIndex={activeFormIndex}
          onSelect={onSelectForm}
        />
      ) : null}
      <div role="tablist" aria-label="Build variants" className={VARIANT_TRACK}>
        {variants.map((v, i) => (
          <VariantTab
            key={v.id || i}
            active={i === activeIndex}
            onClick={() => onSelect(i)}
          >
            {variantDisplayLabel(v, i)}
          </VariantTab>
        ))}
      </div>
      {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
    </div>
  )
}
