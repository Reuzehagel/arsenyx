import {
  getIncarnonBaseName,
  isInnateIncarnon,
} from "@arsenyx/shared/warframe/incarnon-data"
import {
  defaultKitgunComponents,
  isKitgunChamber,
  type KitgunComponents,
  kitgunGripsFor,
} from "@arsenyx/shared/warframe/kitgun-data"
import {
  DEFAULT_DEPLOYMENT_CONTEXT,
  type DeploymentContext,
  type LichBonusElement,
} from "@arsenyx/shared/warframe/types"
import {
  isZawStrike,
  ZAW_DEFAULT_GRIP,
  ZAW_DEFAULT_LINK,
} from "@arsenyx/shared/warframe/zaw-data"
import { useEffect, useState } from "react"

import type { SavedBuildData } from "@/lib/queries/build-query"
import type { HelminthAbility } from "@/lib/queries/helminth-query"
import { padShards, type PlacedShard } from "@/lib/shards"
import type { BrowseCategory, DetailItem } from "@/lib/warframe"

import type { SharedEditorOverrides } from "./editor-cache"

export type ItemExtras = ReturnType<typeof useItemExtras>

/**
 * Editor state outside the mod/arcane slots: reactor, archon shards, zaw and
 * kitgun parts, lich bonus element, incarnon, helminth and deployment context.
 * Per-variant fields seed from the mount-frozen `savedData`; build-wide ones
 * prefer the cached shared override so unsaved edits survive remounts.
 */
export function useItemExtras({
  item,
  category,
  savedData,
  cachedShared,
  incarnonAdapterImages,
}: {
  item: DetailItem
  category: BrowseCategory
  savedData: SavedBuildData
  cachedShared: SharedEditorOverrides | undefined
  incarnonAdapterImages: Record<string, string>
}) {
  const [hasReactor, setHasReactor] = useState(
    () => cachedShared?.hasReactor ?? savedData.hasReactor ?? true,
  )

  // Shards are per-variant. Like slots/arcanes, the live `shards` state seeds
  // from the active variant (mount-frozen `savedData`, copy-on-load resolved)
  // and is captured back into the variants array on switch/save — so the
  // remount a variant/form switch triggers re-hydrates the right set.
  const [shards, setShards] = useState<(PlacedShard | null)[]>(() =>
    padShards(savedData.shards),
  )
  const setShard = (i: number, s: PlacedShard | null) => {
    setShards((prev) => {
      const next = [...prev]
      next[i] = s
      return next
    })
  }

  const [zawComponents, setZawComponents] = useState<
    { grip: string; link: string } | undefined
  >(() => {
    if (cachedShared && "zawComponents" in cachedShared) {
      return cachedShared.zawComponents
    }
    if (savedData.zawComponents) return savedData.zawComponents
    if (isZawStrike(item.name)) {
      return { grip: ZAW_DEFAULT_GRIP, link: ZAW_DEFAULT_LINK }
    }
    return undefined
  })

  useEffect(() => {
    setZawComponents((prev) => {
      if (isZawStrike(item.name)) {
        return prev ?? { grip: ZAW_DEFAULT_GRIP, link: ZAW_DEFAULT_LINK }
      }
      return undefined
    })
  }, [item.name])

  // Kitgun chambers surface as primary/secondary items; the grip's class is
  // fixed by which one the build is anchored to (mirrors the zaw block above).
  const kitgunClass = category === "primary" ? "primary" : "secondary"
  const [kitgunComponents, setKitgunComponents] = useState<
    KitgunComponents | undefined
  >(() => {
    if (cachedShared && "kitgunComponents" in cachedShared) {
      return cachedShared.kitgunComponents
    }
    if (savedData.kitgunComponents) return savedData.kitgunComponents
    if (isKitgunChamber(item.uniqueName)) {
      return defaultKitgunComponents(kitgunClass)
    }
    return undefined
  })

  useEffect(() => {
    setKitgunComponents((prev) => {
      if (!isKitgunChamber(item.uniqueName)) return undefined
      // Re-seed when there's no prior selection, or when the prior grip no
      // longer fits this chamber's class. Primary/secondary variants of one
      // chamber share a uniqueName and `create.tsx` doesn't re-key EditorShell
      // on the swap, so a stale primary grip (e.g. Brash) could otherwise
      // linger on a secondary chamber. Loaders are class-agnostic.
      const gripFits =
        prev && kitgunGripsFor(kitgunClass).some((g) => g.name === prev.grip)
      return gripFits ? prev : defaultKitgunComponents(kitgunClass)
    })
  }, [item.uniqueName, kitgunClass])

  const [lichBonusElement, setLichBonusElement] =
    useState<LichBonusElement | null>(
      () =>
        cachedShared?.lichBonusElement ?? savedData.lichBonusElement ?? null,
    )

  // Innate incarnons (no separate Genesis adapter) default-on; Steel Path
  // Circuit weapons require installing the adapter, so default-off.
  const [incarnonEnabled, setIncarnonEnabled] = useState(
    () => savedData.incarnonEnabled ?? isInnateIncarnon(item.name),
  )
  const [incarnonPerks, setIncarnonPerks] = useState<(string | null)[]>(
    () => savedData.incarnonPerks ?? [],
  )
  const setIncarnonPerkAt = (tierIndex: number, perk: string | null) => {
    setIncarnonPerks((prev) => {
      const next = [...prev]
      while (next.length <= tierIndex) next.push(null)
      next[tierIndex] = perk
      return next
    })
  }

  const [deploymentContext, setDeploymentContext] = useState<DeploymentContext>(
    () => savedData.deploymentContext ?? DEFAULT_DEPLOYMENT_CONTEXT,
  )

  const incarnonBaseName = getIncarnonBaseName(item.name)
  const incarnonAdapterImage =
    incarnonEnabled && incarnonBaseName
      ? incarnonAdapterImages[incarnonBaseName]
      : undefined
  const displayImageName = incarnonAdapterImage ?? item.imageName ?? undefined

  const [helminth, setHelminth] = useState<Record<number, HelminthAbility>>(
    () => savedData.helminth ?? {},
  )
  const setHelminthAt = (i: number, ab: HelminthAbility | null) => {
    setHelminth((prev) => {
      if (!ab) {
        const { [i]: _removed, ...rest } = prev
        return rest
      }
      // Only one subsumed ability per build.
      return { [i]: ab }
    })
  }

  return {
    hasReactor,
    setHasReactor,
    shards,
    setShards,
    setShard,
    zawComponents,
    setZawComponents,
    kitgunComponents,
    setKitgunComponents,
    lichBonusElement,
    setLichBonusElement,
    incarnonEnabled,
    setIncarnonEnabled,
    incarnonPerks,
    setIncarnonPerks,
    setIncarnonPerkAt,
    deploymentContext,
    setDeploymentContext,
    helminth,
    setHelminth,
    setHelminthAt,
    displayImageName,
  }
}
