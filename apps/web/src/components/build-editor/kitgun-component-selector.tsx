import {
  type KitgunClass,
  type KitgunComponents,
  kitgunGripsFor,
  kitgunLoadersFor,
} from "@arsenyx/shared/warframe/kitgun-data"
import { useQuery } from "@tanstack/react-query"

import { PartPickerCard } from "@/components/build-editor/component-part-picker"
import { kitgunImagesQuery } from "@/lib/queries/kitgun-images-query"

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
  const { data: kitgunImages } = useQuery(kitgunImagesQuery)
  const gripOptions = kitgunGripsFor(cls).map((g) => ({ name: g.name }))
  const loaderOptions = kitgunLoadersFor().map((l) => ({ name: l.name }))

  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <PartPickerCard
        label="Grip"
        value={components.grip}
        options={gripOptions}
        onChange={(grip) => onChange?.({ ...components, grip })}
        readOnly={readOnly}
        images={kitgunImages}
      />
      <PartPickerCard
        label="Loader"
        value={components.loader}
        options={loaderOptions}
        onChange={(loader) => onChange?.({ ...components, loader })}
        readOnly={readOnly}
        images={kitgunImages}
      />
    </div>
  )
}
