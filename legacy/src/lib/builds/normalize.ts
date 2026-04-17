import "server-only"
import type { BuildVisibility } from "@/generated/prisma/client"

import { prisma } from "@/lib/db"
import { isOrgMember } from "@/lib/db/organizations"
import {
  calculateFormaCount,
  calculateRemainingCapacity,
} from "@/lib/warframe/capacity"
import { getHelminthAbilities } from "@/lib/warframe/helminth"
import { getFullItem } from "@/lib/warframe/items"
import { getModBaseName } from "@/lib/warframe/mod-variants"
import {
  getAugmentModsForHelminthAbility,
  getModByUniqueName,
  getModsForItem,
} from "@/lib/warframe/mods"
import { BuildStateSchema } from "@/lib/warframe/schemas"
import { findStat } from "@/lib/warframe/shards"
import { toPlacedMod } from "@/lib/warframe/mod-utils"
import type {
  BrowseCategory,
  BuildState,
  HelminthAbility,
  Mod,
  PlacedArcane,
  PlacedShard,
} from "@/lib/warframe/types"

import { BuildDraftPayloadSchema, type BuildDraftPayload } from "./draft"
import {
  createBaseBuildState,
  getBuildLayout,
  getBuildSlot,
  getCompatibleArcanesForSlotIndex,
  setBuildSlot,
} from "./layout"

export interface BuildDraftViewer {
  userId: string
  isBanned: boolean
}

export interface NormalizedBuildPayload {
  name: string
  description: string | null
  visibility: BuildVisibility
  itemUniqueName: string
  itemCategory: BrowseCategory
  itemName: string
  itemImageName: string | null
  buildData: BuildState
  organizationId: string | null
  partnerBuildIds: string[]
  guideSummary: string | null
  guideDescription: string | null
}

export class BuildDraftError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message)
    this.name = "BuildDraftError"
  }
}

function buildDraftError(
  status: number,
  code: string,
  message: string,
  field?: string,
): never {
  throw new BuildDraftError(status, code, message, field)
}

function pathToField(path: (string | number)[]): string | undefined {
  if (path.length === 0) return undefined

  return path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
    .join(".")
    .replace(/\.\[/g, "[")
}

function parseDraftPayload(input: unknown): BuildDraftPayload {
  const parsed = BuildDraftPayloadSchema.safeParse(input)
  if (parsed.success) {
    return parsed.data
  }

  const issue = parsed.error.issues[0]
  buildDraftError(
    422,
    "INVALID_PAYLOAD",
    issue?.message ?? "Invalid build payload",
    issue
      ? pathToField(
          issue.path.filter(
            (segment): segment is string | number =>
              typeof segment === "string" || typeof segment === "number",
          ),
        )
      : undefined,
  )
}

function isAuraMod(mod: Mod): boolean {
  const compatName = mod.compatName?.toLowerCase() ?? ""
  const type = mod.type?.toLowerCase() ?? ""

  return compatName === "aura" || type.includes("aura")
}

function isExilusCompatibleMod(mod: Mod): boolean {
  return mod.isExilus === true || mod.isUtility === true
}

function validateModForSlot(
  slotId: string,
  slotType: "aura" | "exilus" | "normal",
  mod: Mod,
  compatibleMods: Map<string, Mod>,
): void {
  if (!compatibleMods.has(mod.uniqueName)) {
    buildDraftError(
      422,
      "INCOMPATIBLE_MOD",
      `${mod.name} is not compatible with this item`,
      `${slotId}.mod.uniqueName`,
    )
  }

  if (slotType === "aura" && !isAuraMod(mod)) {
    buildDraftError(
      422,
      "INVALID_AURA_MOD",
      `${mod.name} cannot be placed in the aura slot`,
      `${slotId}.mod.uniqueName`,
    )
  }

  if (slotType !== "aura" && isAuraMod(mod)) {
    buildDraftError(
      422,
      "INVALID_SLOT_MOD",
      `${mod.name} can only be placed in the aura slot`,
      `${slotId}.mod.uniqueName`,
    )
  }

  if (slotType === "exilus" && !isExilusCompatibleMod(mod)) {
    buildDraftError(
      422,
      "INVALID_EXILUS_MOD",
      `${mod.name} is not exilus-compatible`,
      `${slotId}.mod.uniqueName`,
    )
  }
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function resolveOrganizationId(
  organizationSlug: string | null | undefined,
  viewer: BuildDraftViewer,
): Promise<string | null> {
  const normalizedSlug = organizationSlug?.trim().toLowerCase()
  if (!normalizedSlug) {
    return null
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: normalizedSlug },
    select: { id: true, slug: true },
  })

  if (!organization) {
    buildDraftError(
      409,
      "ORGANIZATION_NOT_FOUND",
      `Organization '${normalizedSlug}' was not found`,
      "organizationSlug",
    )
  }

  const isMember = await isOrgMember(organization.id, viewer.userId)
  if (!isMember) {
    buildDraftError(
      409,
      "ORGANIZATION_ACCESS_DENIED",
      `You are not allowed to publish into '${organization.slug}'`,
      "organizationSlug",
    )
  }

  return organization.id
}

async function resolveExistingBuildContext(existingBuildId?: string): Promise<{
  id: string
  userId: string
  organizationId: string | null
} | null> {
  if (!existingBuildId) {
    return null
  }

  const existingBuild = await prisma.build.findUnique({
    where: { id: existingBuildId },
    select: {
      id: true,
      userId: true,
      organizationId: true,
    },
  })

  if (!existingBuild) {
    buildDraftError(404, "BUILD_NOT_FOUND", "Build not found")
  }

  return existingBuild
}

function validateOrganizationRehome(
  viewer: BuildDraftViewer,
  existingBuild: {
    userId: string
    organizationId: string | null
  } | null,
  nextOrganizationId: string | null,
): void {
  if (!existingBuild) {
    return
  }

  if (existingBuild.organizationId === nextOrganizationId) {
    return
  }

  if (existingBuild.userId !== viewer.userId) {
    buildDraftError(
      403,
      "ORGANIZATION_REHOME_DENIED",
      "Only the build owner can move a build between personal and organization ownership",
      "organizationSlug",
    )
  }
}

async function resolvePartnerBuildIds(
  partnerBuildSlugs: string[] | undefined,
  viewer: BuildDraftViewer,
  existingBuildId?: string,
): Promise<string[]> {
  const slugs = [
    ...new Set((partnerBuildSlugs ?? []).map((slug) => slug.trim())),
  ]

  if (slugs.length === 0) {
    return []
  }

  const builds = await prisma.build.findMany({
    where: {
      slug: { in: slugs },
    },
    select: {
      id: true,
      slug: true,
      userId: true,
      organizationId: true,
    },
  })

  const buildsBySlug = new Map(builds.map((build) => [build.slug, build]))

  for (const slug of slugs) {
    const build = buildsBySlug.get(slug)
    if (!build) {
      buildDraftError(
        422,
        "PARTNER_BUILD_NOT_FOUND",
        `Partner build '${slug}' was not found`,
        "partnerBuildSlugs",
      )
    }

    if (build.id === existingBuildId) {
      buildDraftError(
        422,
        "PARTNER_BUILD_SELF_REFERENCE",
        "A build cannot link to itself as a partner build",
        "partnerBuildSlugs",
      )
    }

    const editable =
      build.userId === viewer.userId ||
      (build.organizationId
        ? await isOrgMember(build.organizationId, viewer.userId)
        : false)

    if (!editable) {
      buildDraftError(
        422,
        "PARTNER_BUILD_ACCESS_DENIED",
        `You cannot link partner build '${slug}'`,
        "partnerBuildSlugs",
      )
    }
  }

  return slugs.map((slug) => buildsBySlug.get(slug)!.id)
}

function parseNormalizedBuildData(buildData: BuildState): BuildState {
  const result = BuildStateSchema.safeParse(buildData)
  if (result.success) {
    return result.data
  }

  const issue = result.error.issues[0]
  buildDraftError(
    422,
    "INVALID_NORMALIZED_BUILD",
    issue?.message ?? "Normalized build data is invalid",
    issue
      ? pathToField(
          issue.path.filter(
            (segment): segment is string | number =>
              typeof segment === "string" || typeof segment === "number",
          ),
        )
      : undefined,
  )
}

export async function normalizeBuildDraftForPersistence(
  viewer: BuildDraftViewer,
  input: unknown,
  options?: {
    existingBuildId?: string
  },
): Promise<NormalizedBuildPayload> {
  const draft = parseDraftPayload(input)

  if (viewer.isBanned) {
    buildDraftError(403, "BANNED_USER", "Your account has been suspended")
  }

  const item = getFullItem(draft.itemCategory, draft.itemUniqueName)
  if (!item) {
    buildDraftError(
      422,
      "ITEM_NOT_FOUND",
      `Item '${draft.itemUniqueName}' was not found in category '${draft.itemCategory}'`,
      "itemUniqueName",
    )
  }

  const layout = getBuildLayout(item, draft.itemCategory)
  let resolvedHelminthAbility: HelminthAbility | undefined
  if (draft.build.helminthAbility) {
    if (!layout.helminthAllowed) {
      buildDraftError(
        422,
        "HELMINTH_NOT_SUPPORTED",
        "Helminth abilities are not supported for this item",
        "build.helminthAbility",
      )
    }

    if (
      draft.build.helminthAbility.slotIndex < 0 ||
      draft.build.helminthAbility.slotIndex > 3
    ) {
      buildDraftError(
        422,
        "INVALID_HELMINTH_SLOT",
        `Helminth slot index ${draft.build.helminthAbility.slotIndex} is invalid`,
        "build.helminthAbility.slotIndex",
      )
    }

    const abilityMap = new Map<string, HelminthAbility>(
      getHelminthAbilities().map((ability) => [ability.uniqueName, ability]),
    )
    const ability = abilityMap.get(draft.build.helminthAbility.uniqueName)
    if (!ability) {
      buildDraftError(
        422,
        "INVALID_HELMINTH_ABILITY",
        `Helminth ability '${draft.build.helminthAbility.uniqueName}' was not found`,
        "build.helminthAbility.uniqueName",
      )
    }

    resolvedHelminthAbility = ability
  }

  const compatibleModsList = [
    ...getModsForItem(item),
    ...(resolvedHelminthAbility
      ? getAugmentModsForHelminthAbility(resolvedHelminthAbility)
      : []),
  ]
  const compatibleMods = new Map(
    compatibleModsList.map((mod) => [mod.uniqueName, mod]),
  )
  const buildState = createBaseBuildState(item, draft.itemCategory)

  buildState.hasReactor = draft.build.hasReactor
  buildState.baseCapacity = draft.build.hasReactor ? 60 : 30

  const usedModBaseNames = new Set<string>()
  for (const slotDraft of draft.build.slots) {
    const slot = getBuildSlot(buildState, slotDraft.slotId)
    if (!slot) {
      buildDraftError(
        422,
        "UNKNOWN_SLOT",
        `Unknown slot '${slotDraft.slotId}'`,
        "build.slots",
      )
    }

    const nextSlot = {
      ...slot,
      ...(slotDraft.formaPolarity !== undefined
        ? { formaPolarity: slotDraft.formaPolarity }
        : {}),
    }

    if (slotDraft.mod) {
      const mod = getModByUniqueName(slotDraft.mod.uniqueName)
      if (!mod) {
        buildDraftError(
          422,
          "MOD_NOT_FOUND",
          `Mod '${slotDraft.mod.uniqueName}' was not found`,
          "build.slots",
        )
      }

      validateModForSlot(
        slotDraft.slotId,
        slot.type as "aura" | "exilus" | "normal",
        mod,
        compatibleMods,
      )

      if (!Number.isInteger(slotDraft.mod.rank)) {
        buildDraftError(
          422,
          "INVALID_MOD_RANK",
          `Rank for ${mod.name} must be an integer`,
          "build.slots",
        )
      }

      if (slotDraft.mod.rank > mod.fusionLimit) {
        buildDraftError(
          422,
          "INVALID_MOD_RANK",
          `Rank ${slotDraft.mod.rank} exceeds max rank ${mod.fusionLimit} for ${mod.name}`,
          "build.slots",
        )
      }

      const baseName = getModBaseName(mod.name)
      if (usedModBaseNames.has(baseName)) {
        buildDraftError(
          422,
          "DUPLICATE_MOD",
          `Duplicate mod family '${baseName}' is not allowed`,
          "build.slots",
        )
      }

      usedModBaseNames.add(baseName)
      nextSlot.mod = toPlacedMod(mod, slotDraft.mod.rank)
    }

    setBuildSlot(buildState, slotDraft.slotId, nextSlot)
  }

  const usedArcaneNames = new Set<string>()
  for (const arcaneDraft of draft.build.arcanes ?? []) {
    if (arcaneDraft.slotIndex >= layout.arcaneSlotCount) {
      buildDraftError(
        422,
        "INVALID_ARCANE_SLOT",
        `Arcane slot index ${arcaneDraft.slotIndex} is out of range`,
        "build.arcanes",
      )
    }

    const compatibleArcanes = new Map(
      getCompatibleArcanesForSlotIndex(
        item,
        draft.itemCategory,
        arcaneDraft.slotIndex,
      ).map((arcane) => [arcane.uniqueName, arcane]),
    )
    const arcane = compatibleArcanes.get(arcaneDraft.uniqueName)

    if (!arcane) {
      buildDraftError(
        422,
        "INVALID_ARCANE",
        `Arcane '${arcaneDraft.uniqueName}' is not compatible with this slot`,
        "build.arcanes",
      )
    }

    const maxRank = Math.max((arcane.levelStats?.length ?? 6) - 1, 0)
    if (arcaneDraft.rank > maxRank) {
      buildDraftError(
        422,
        "INVALID_ARCANE_RANK",
        `Rank ${arcaneDraft.rank} exceeds max rank ${maxRank} for ${arcane.name}`,
        "build.arcanes",
      )
    }

    if (usedArcaneNames.has(arcane.uniqueName)) {
      buildDraftError(
        422,
        "DUPLICATE_ARCANE",
        `Duplicate arcane '${arcane.name}' is not allowed`,
        "build.arcanes",
      )
    }

    usedArcaneNames.add(arcane.uniqueName)
    const placedArcane: PlacedArcane = {
      uniqueName: arcane.uniqueName,
      name: arcane.name,
      imageName: arcane.imageName,
      rarity: arcane.rarity,
      rank: arcaneDraft.rank,
    }
    buildState.arcaneSlots[arcaneDraft.slotIndex] = placedArcane
  }

  for (const shardDraft of draft.build.shards ?? []) {
    if (layout.shardSlotCount === 0) {
      buildDraftError(
        422,
        "SHARDS_NOT_SUPPORTED",
        "Shards are not supported for this item",
        "build.shards",
      )
    }

    if (shardDraft.slotIndex >= layout.shardSlotCount) {
      buildDraftError(
        422,
        "INVALID_SHARD_SLOT",
        `Shard slot index ${shardDraft.slotIndex} is out of range`,
        "build.shards",
      )
    }

    const stat = findStat(shardDraft.color, shardDraft.stat)
    if (!stat) {
      buildDraftError(
        422,
        "INVALID_SHARD_STAT",
        `'${shardDraft.stat}' is not a valid ${shardDraft.color} shard stat`,
        "build.shards",
      )
    }

    const placedShard: PlacedShard = {
      color: shardDraft.color,
      stat: stat.name,
      tauforged: shardDraft.tauforged,
    }

    buildState.shardSlots[shardDraft.slotIndex] = placedShard
  }

  if (draft.build.helminthAbility && resolvedHelminthAbility) {
    buildState.helminthAbility = {
      slotIndex: draft.build.helminthAbility.slotIndex,
      ability: resolvedHelminthAbility,
    }
  }

  buildState.buildName = draft.name.trim()
  buildState.baseCapacity = buildState.hasReactor ? 60 : 30
  buildState.currentCapacity = calculateRemainingCapacity(buildState)
  buildState.formaCount = calculateFormaCount(
    buildState.normalSlots,
    buildState.auraSlots,
    buildState.exilusSlot,
  )

  const normalizedBuildData = parseNormalizedBuildData(buildState)
  const [existingBuild, organizationId, partnerBuildIds] = await Promise.all([
    resolveExistingBuildContext(options?.existingBuildId),
    resolveOrganizationId(draft.organizationSlug ?? null, viewer),
    resolvePartnerBuildIds(
      draft.partnerBuildSlugs,
      viewer,
      options?.existingBuildId,
    ),
  ])
  validateOrganizationRehome(viewer, existingBuild, organizationId)

  const guideSummary = normalizeOptionalString(draft.guide?.summary)
  const guideDescription = normalizeOptionalString(draft.guide?.description)

  return {
    name: draft.name.trim(),
    description: normalizeOptionalString(draft.description),
    visibility: (draft.visibility ?? "PUBLIC") as BuildVisibility,
    itemUniqueName: item.uniqueName,
    itemCategory: draft.itemCategory,
    itemName: item.name,
    itemImageName: item.imageName ?? null,
    buildData: normalizedBuildData,
    organizationId,
    partnerBuildIds,
    guideSummary,
    guideDescription,
  }
}

export function getBuildDraftErrorResponse(error: unknown) {
  if (!(error instanceof BuildDraftError)) {
    return null
  }

  return {
    status: error.status,
    body: {
      error: {
        code: error.code,
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
      },
    },
  }
}
