"use client"

import Image from "next/image"
import { useState } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getImageUrl } from "@/lib/warframe/images"
import {
  ZAW_GRIPS,
  ZAW_LINKS,
  getZawComponentImage,
} from "@/lib/warframe/zaw-data"

interface ZawComponentSelectorProps {
  gripName: string
  linkName: string
  onGripChange: (grip: string) => void
  onLinkChange: (link: string) => void
  readOnly?: boolean
}

export function ZawComponentSelector({
  gripName,
  linkName,
  onGripChange,
  onLinkChange,
  readOnly = false,
}: ZawComponentSelectorProps) {
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <ZawPartCard
        label="Grip"
        value={gripName}
        options={ZAW_GRIPS.map((g) => ({
          name: g.name,
          hint: g.oneHanded ? "1H" : "2H",
        }))}
        onChange={onGripChange}
        readOnly={readOnly}
      />
      <ZawPartCard
        label="Link"
        value={linkName}
        options={ZAW_LINKS.map((l) => ({ name: l.name }))}
        onChange={onLinkChange}
        readOnly={readOnly}
      />
    </div>
  )
}

interface ZawPartCardProps {
  label: string
  value: string
  options: { name: string; hint?: string }[]
  onChange: (name: string) => void
  readOnly: boolean
}

function ZawPartCard({
  label,
  value,
  options,
  onChange,
  readOnly,
}: ZawPartCardProps) {
  const [open, setOpen] = useState(false)
  const imageName = getZawComponentImage(value)

  const card = (
    <div
      className={cn(
        "bg-card/80 relative flex flex-col items-center overflow-hidden rounded-md select-none",
        "h-[80px] w-[90px] sm:h-[90px] sm:w-[110px] md:h-[100px] md:w-[130px]",
        !readOnly &&
          "hover:ring-primary/50 cursor-pointer transition-shadow hover:ring-1",
        open && "ring-primary ring-offset-background ring-2 ring-offset-1",
      )}
    >
      <div className="relative mt-1.5 h-[55px] w-[70px] overflow-hidden rounded sm:h-[60px] sm:w-[76px]">
        <Image
          src={getImageUrl(imageName)}
          alt={value}
          fill
          sizes="80px"
          className="object-contain"
          unoptimized
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
        <div className="grid max-h-[320px] grid-cols-3 gap-1.5 overflow-y-auto">
          {options.map((opt) => {
            const optImage = getZawComponentImage(opt.name)
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
                  "bg-card/60 flex flex-col items-center gap-0.5 rounded p-1 text-[10px] transition-colors",
                  "hover:bg-accent",
                  isSelected && "ring-primary ring-1",
                )}
              >
                <div className="relative h-[44px] w-[52px] overflow-hidden rounded">
                  <Image
                    src={getImageUrl(optImage)}
                    alt={opt.name}
                    fill
                    sizes="56px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="line-clamp-1 w-full text-center leading-tight font-medium">
                  {opt.name}
                </span>
                {opt.hint && (
                  <span className="text-muted-foreground text-[9px]">
                    {opt.hint}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
