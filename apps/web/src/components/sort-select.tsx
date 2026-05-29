import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Generic single-select sort dropdown. `items` drives both the rendered
 *  options and the value type; `triggerWidth` is a Tailwind width class so each
 *  surface keeps its own trigger sizing. */
export function SortSelect<T extends string>({
  items,
  value,
  onChange,
  triggerWidth,
}: {
  items: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  triggerWidth: string
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T)
      }}
    >
      <SelectTrigger className={triggerWidth}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
