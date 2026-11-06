import type {
  HelminthAbility,
  PerVariantDataField,
  SavedBuildData,
} from "@arsenyx/shared/warframe/build-data"
import { isInnateIncarnon } from "@arsenyx/shared/warframe/incarnon-data"
import {
  defaultKitgunComponents,
  isKitgunChamber,
  type KitgunClass,
  type KitgunComponents,
  kitgunGripsFor,
} from "@arsenyx/shared/warframe/kitgun-data"
import {
  DEFAULT_OPERATOR_AMP,
  parseFocusSchool,
  parseOperatorAmp,
} from "@arsenyx/shared/warframe/operator-loadout"
import {
  DEFAULT_DEPLOYMENT_CONTEXT,
  type DeploymentContext,
  type LichBonusElement,
  type BrowseCategory,
  type PlacedShard,
} from "@arsenyx/shared/warframe/types"
import {
  isZawItem,
  ZAW_DEFAULT_GRIP,
  ZAW_DEFAULT_LINK,
} from "@arsenyx/shared/warframe/zaw-data"

import type { DetailItem } from "@/lib/catalog"
import { padShards } from "@/lib/shards"

/**
 * Loadout state outside the mod/arcane slots: reactor, archon shards, zaw and
 * kitgun parts, lich element, incarnon, helminth, deployment context and the
 * Operator's amp/school. One record so undo, autosave, capture and share
 * handle it as a unit instead of re-listing fields.
 */
export interface ExtrasState {
  hasReactor: boolean
  shards: (PlacedShard | null)[]
  helminth: Record<number, HelminthAbility>
  zawComponents: { grip: string; link: string } | undefined
  kitgunComponents: KitgunComponents | undefined
  lichBonusElement: LichBonusElement | null
  incarnonEnabled: boolean
  incarnonPerks: (string | null)[]
  deploymentContext: DeploymentContext
  /** Operator-only; undefined elsewhere so other builds never carry an Amp. */
  operatorAmp: string | undefined
  /** Operator-only; unset until picked (no sensible default school). */
  focusSchool: string | undefined
}

/** Extras that are build-wide rather than per-variant. */
export const BUILD_WIDE_EXTRAS = [
  "hasReactor",
  "zawComponents",
  "kitgunComponents",
  "lichBonusElement",
] as const satisfies readonly (keyof ExtrasState)[]

export type BuildWideExtras = Pick<
  ExtrasState,
  (typeof BUILD_WIDE_EXTRAS)[number]
>

// Every extras field is build-wide, per-variant data, or the per-variant
// shards — so a new field can't skip deciding whether a variant switch keeps it.
type ExtrasPartition =
  | (typeof BUILD_WIDE_EXTRAS)[number]
  | Exclude<PerVariantDataField, "formIndex">
  | "shards"
const _extrasPartitioned: [keyof ExtrasState] extends [ExtrasPartition]
  ? [ExtrasPartition] extends [keyof ExtrasState]
    ? true
    : never
  : never = true

/** Kitgun chambers surface as primary/secondary items; the grip's class is
 *  fixed by which one the build is anchored to. */
export function kitgunClass(category: BrowseCategory): KitgunClass {
  return category === "primary" ? "primary" : "secondary"
}

/** Keep zaw/kitgun parts consistent with the item: default parts for a
 *  modular item, none otherwise, and a fresh grip when the current one doesn't
 *  fit the chamber's class (one chamber backs both a primary and a secondary). */
export function reconcileModularParts(
  extras: ExtrasState,
  item: Pick<DetailItem, "name" | "uniqueName">,
  category: BrowseCategory,
): ExtrasState {
  const zawComponents = isZawItem(item)
    ? (extras.zawComponents ?? {
        grip: ZAW_DEFAULT_GRIP,
        link: ZAW_DEFAULT_LINK,
      })
    : undefined
  let kitgunComponents: KitgunComponents | undefined
  if (isKitgunChamber(item.uniqueName)) {
    const cls = kitgunClass(category)
    const prev = extras.kitgunComponents
    kitgunComponents =
      prev && kitgunGripsFor(cls).some((g) => g.name === prev.grip)
        ? prev
        : defaultKitgunComponents(cls)
  }
  if (
    zawComponents === extras.zawComponents &&
    kitgunComponents === extras.kitgunComponents
  ) {
    return extras
  }
  return { ...extras, zawComponents, kitgunComponents }
}

/** A saved variant's extras with the defaults the editor would show. */
export function extrasFromSaved(
  saved: SavedBuildData,
  item: Pick<DetailItem, "name" | "uniqueName">,
  category: BrowseCategory,
): ExtrasState {
  const isOperator = category === "operators"
  return reconcileModularParts(
    {
      hasReactor: saved.hasReactor ?? true,
      shards: padShards(saved.shards),
      helminth: saved.helminth ?? {},
      zawComponents: saved.zawComponents,
      kitgunComponents: saved.kitgunComponents,
      lichBonusElement: saved.lichBonusElement ?? null,
      // Innate incarnons (no separate Genesis adapter) default on; Steel Path
      // Circuit weapons need the adapter installed, so default off.
      incarnonEnabled: saved.incarnonEnabled ?? isInnateIncarnon(item.name),
      incarnonPerks: saved.incarnonPerks ?? [],
      deploymentContext: saved.deploymentContext ?? DEFAULT_DEPLOYMENT_CONTEXT,
      operatorAmp: isOperator
        ? (parseOperatorAmp(saved.operatorAmp) ?? DEFAULT_OPERATOR_AMP)
        : undefined,
      focusSchool: isOperator ? parseFocusSchool(saved.focusSchool) : undefined,
    },
    item,
    category,
  )
}

/** The extras in their persisted shape (no null lich element). */
export function extrasToSaved(extras: ExtrasState) {
  return {
    ...extras,
    lichBonusElement: extras.lichBonusElement ?? undefined,
  } satisfies Partial<SavedBuildData>
}

export function withShard(
  extras: ExtrasState,
  index: number,
  shard: PlacedShard | null,
): ExtrasState {
  const shards = [...extras.shards]
  shards[index] = shard
  return { ...extras, shards }
}

/** Only one subsumed ability per build. */
export function withHelminth(
  extras: ExtrasState,
  index: number,
  ability: HelminthAbility | null,
): ExtrasState {
  if (ability) return { ...extras, helminth: { [index]: ability } }
  const { [index]: _removed, ...helminth } = extras.helminth
  return { ...extras, helminth }
}

export function withIncarnonPerk(
  extras: ExtrasState,
  tierIndex: number,
  perk: string | null,
): ExtrasState {
  const incarnonPerks = [...extras.incarnonPerks]
  while (incarnonPerks.length <= tierIndex) incarnonPerks.push(null)
  incarnonPerks[tierIndex] = perk
  return { ...extras, incarnonPerks }
}
