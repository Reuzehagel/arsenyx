"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ZAW_GRIPS,
  ZAW_LINKS,
  getZawWeaponType,
} from "@/lib/warframe/zaw-data"

interface ZawComponentSelectorProps {
  strikeName: string
  gripName: string
  linkName: string
  onGripChange: (grip: string) => void
  onLinkChange: (link: string) => void
  readOnly?: boolean
}

const gripItems = ZAW_GRIPS.map((grip) => ({ value: grip.name, label: grip.name }))
const linkItems = ZAW_LINKS.map((link) => ({ value: link.name, label: link.name }))

export function ZawComponentSelector({
  strikeName,
  gripName,
  linkName,
  onGripChange,
  onLinkChange,
  readOnly = false,
}: ZawComponentSelectorProps) {
  const weaponType = getZawWeaponType(strikeName, gripName)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        Zaw Parts
      </p>

      {weaponType && (
        <p className="text-xs">
          <span className="text-muted-foreground">Type: </span>
          <span className="font-medium">{weaponType}</span>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-muted-foreground text-[10px] uppercase">
          Grip
        </label>
        <Select
          items={gripItems}
          value={gripName}
          onValueChange={(value) => {
            if (value) onGripChange(value)
          }}
        >
          <SelectTrigger className="h-7 text-xs" disabled={readOnly}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZAW_GRIPS.map((grip) => (
              <SelectItem key={grip.name} value={grip.name}>
                {grip.name}
                <span className="text-muted-foreground ml-1">
                  ({grip.oneHanded ? "1H" : "2H"})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-muted-foreground text-[10px] uppercase">
          Link
        </label>
        <Select
          items={linkItems}
          value={linkName}
          onValueChange={(value) => {
            if (value) onLinkChange(value)
          }}
        >
          <SelectTrigger className="h-7 text-xs" disabled={readOnly}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZAW_LINKS.map((link) => (
              <SelectItem key={link.name} value={link.name}>
                {link.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
