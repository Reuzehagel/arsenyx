import { ZAW_GRIPS, ZAW_LINKS } from "@arsenyx/shared/warframe/zaw-data"
import { useQuery } from "@tanstack/react-query"

import { PartPickerCard } from "@/components/build-editor/component-part-picker"
import { zawImagesQuery } from "@/lib/queries/zaw-images-query"

const GRIP_OPTIONS = ZAW_GRIPS.map((g) => ({
  name: g.name,
  hint: g.oneHanded ? "1H" : "2H",
}))
const LINK_OPTIONS = ZAW_LINKS.map((l) => ({ name: l.name }))

export interface ZawComponents {
  grip: string
  link: string
}

export interface ZawComponentSelectorProps {
  components: ZawComponents
  onChange?: (components: ZawComponents) => void
  readOnly?: boolean
}

export function ZawComponentSelector({
  components,
  onChange,
  readOnly = false,
}: ZawComponentSelectorProps) {
  const { data: zawImages } = useQuery(zawImagesQuery)

  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <PartPickerCard
        label="Grip"
        value={components.grip}
        options={GRIP_OPTIONS}
        onChange={(grip) => onChange?.({ ...components, grip })}
        readOnly={readOnly}
        images={zawImages}
      />
      <PartPickerCard
        label="Link"
        value={components.link}
        options={LINK_OPTIONS}
        onChange={(link) => onChange?.({ ...components, link })}
        readOnly={readOnly}
        images={zawImages}
      />
    </div>
  )
}
