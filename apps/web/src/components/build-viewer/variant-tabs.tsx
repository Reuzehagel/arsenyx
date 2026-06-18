import { FormToggle } from "@/components/form-toggle"
import { cn } from "@/lib/util/utils"

/**
 * Read-only tab bar for switching between a build's variants in the
 * viewer. Mirrors the styling of `EditorVariantBar` (active = primary
 * fill) without the settings popover or add/duplicate/delete affordances.
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
        {variants.map((v, i) => {
          const active = i === activeIndex
          return (
            <button
              key={v.id || i}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(i)}
              className={cn(
                "rounded-md border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {v.label || `Variant ${i + 1}`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
