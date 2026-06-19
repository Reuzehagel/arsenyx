import { FormToggle } from "@/components/form-toggle"

import { VariantTab } from "./variant-tab"

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
}: {
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
    <div className="flex flex-col items-center gap-1.5 pb-1">
      {formNames && onSelectForm ? (
        <FormToggle
          formNames={formNames}
          activeFormIndex={activeFormIndex}
          onSelect={onSelectForm}
        />
      ) : null}
      <div
        role="tablist"
        aria-label="Build variants"
        className="flex flex-wrap items-center justify-center gap-1.5"
      >
        {variants.map((v, i) => (
          <VariantTab
            key={v.id || i}
            active={i === activeIndex}
            onClick={() => onSelect(i)}
            className="rounded-md px-3 py-1 text-sm"
          >
            {v.label || `Variant ${i + 1}`}
          </VariantTab>
        ))}
      </div>
    </div>
  )
}
