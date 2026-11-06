import {
  LICH_BONUS_ELEMENTS,
  type LichBonusElement,
} from "@arsenyx/shared/warframe/types"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LICH_BONUS_ITEMS: { value: LichBonusElement | null; label: string }[] = [
  { value: null, label: "No element selected" },
  ...LICH_BONUS_ELEMENTS.map((el) => ({ value: el, label: `+60% ${el}` })),
]

export function LichBonusElementPicker({
  value,
  onChange,
  readOnly,
}: {
  value: LichBonusElement | null
  onChange: (v: LichBonusElement | null) => void
  readOnly: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Bonus Element
      </span>
      <Select
        items={LICH_BONUS_ITEMS}
        value={value}
        onValueChange={(v) => onChange(v as LichBonusElement | null)}
        disabled={readOnly}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {LICH_BONUS_ITEMS.map((item) => (
              <SelectItem key={item.value ?? "none"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
