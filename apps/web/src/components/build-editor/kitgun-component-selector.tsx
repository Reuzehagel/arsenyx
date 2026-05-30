import {
  type KitgunClass,
  type KitgunComponents,
  kitgunGripsFor,
  kitgunLoadersFor,
} from "@arsenyx/shared/warframe/kitgun-data"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { kitgunImagesQuery } from "@/lib/queries/kitgun-images-query"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

export interface KitgunComponentSelectorProps {
  components: KitgunComponents
  /** Weapon class of the chamber — primary chambers only accept primary
   *  grips, secondary chambers only secondary grips. Loaders are unrestricted. */
  cls: KitgunClass
  onChange?: (components: KitgunComponents) => void
  readOnly?: boolean
}

export function KitgunComponentSelector({
  components,
  cls,
  onChange,
  readOnly = false,
}: KitgunComponentSelectorProps) {
  const gripOptions = kitgunGripsFor(cls).map((g) => ({ name: g.name }))
  const loaderOptions = kitgunLoadersFor().map((l) => ({ name: l.name }))

  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <KitgunPartCard
        label="Grip"
        value={components.grip}
        options={gripOptions}
        onChange={(grip) => onChange?.({ ...components, grip })}
        readOnly={readOnly}
      />
      <KitgunPartCard
        label="Loader"
        value={components.loader}
        options={loaderOptions}
        onChange={(loader) => onChange?.({ ...components, loader })}
        readOnly={readOnly}
      />
    </div>
  )
}

interface KitgunPartCardProps {
  label: string
  value: string
  options: { name: string }[]
  onChange: (name: string) => void
  readOnly: boolean
}

function KitgunPartCard({
  label,
  value,
  options,
  onChange,
  readOnly,
}: KitgunPartCardProps) {
  const [open, setOpen] = useState(false)
  const { data: kitgunImages } = useQuery(kitgunImagesQuery)
  const imageName = kitgunImages?.[value]

  const card = (
    <div
      className={cn(
        "bg-card/80 relative flex flex-col items-center overflow-hidden rounded-md select-none",
        "h-[90px] w-[100px]",
        !readOnly &&
          "hover:ring-primary/50 cursor-pointer ring-1 ring-transparent transition-[box-shadow,color]",
        open && "ring-primary ring-offset-background ring-2 ring-offset-1",
      )}
    >
      <div className="relative mt-1.5 h-[50px] w-[64px] overflow-hidden rounded">
        <img
          src={getImageUrl(imageName)}
          alt={value}
          className="h-full w-full object-contain"
        />
      </div>
      <span className="text-foreground mt-0.5 line-clamp-1 px-1 text-center text-[10px] leading-tight font-medium">
        {value}
      </span>
      <span className="text-muted-foreground/70 mt-0.5 text-[9px] font-medium tracking-wider uppercase">
        {label}
      </span>
    </div>
  )

  if (readOnly) return card

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" aria-label={`Select ${label.toLowerCase()}`} />
        }
      >
        {card}
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2" align="center">
        <div className="grid max-h-[320px] grid-cols-3 gap-1.5 overflow-y-auto p-0.5">
          {options.map((opt) => {
            const optImage = kitgunImages?.[opt.name]
            const isSelected = opt.name === value
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => {
                  onChange(opt.name)
                  setOpen(false)
                }}
                className={cn(
                  "bg-card/60 hover:bg-accent flex flex-col items-center gap-0.5 rounded p-1 text-[10px] transition-colors",
                  isSelected && "ring-primary ring-1 ring-inset",
                )}
              >
                <div className="relative h-[44px] w-[52px] overflow-hidden rounded">
                  <img
                    src={getImageUrl(optImage)}
                    alt={opt.name}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="line-clamp-1 w-full text-center leading-tight font-medium">
                  {opt.name}
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
