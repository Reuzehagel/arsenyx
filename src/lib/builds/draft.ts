import type { BuildVisibility } from "@/generated/prisma/client"
import { z } from "zod"

import type {
  BrowseCategory,
  BuildState,
  Polarity,
  ShardColor,
} from "@/lib/warframe/types"

const VisibilitySchema = z.enum(["PUBLIC", "UNLISTED", "PRIVATE"])
const BrowseCategorySchema = z.enum([
  "warframes",
  "primary",
  "secondary",
  "melee",
  "necramechs",
  "companions",
  "companion-weapons",
  "exalted-weapons",
  "archwing",
])
const PolaritySchema = z.enum([
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
  "any",
  "universal",
])
const ShardColorSchema = z.enum([
  "crimson",
  "amber",
  "azure",
  "topaz",
  "violet",
  "emerald",
])

const BuildDraftModSchema = z
  .object({
    uniqueName: z.string().min(1),
    rank: z.int().min(0),
  })
  .strict()

const BuildDraftSlotSchema = z
  .object({
    slotId: z.string().min(1),
    formaPolarity: PolaritySchema.optional(),
    mod: BuildDraftModSchema.optional(),
  })
  .strict()

const BuildDraftArcaneSchema = z
  .object({
    slotIndex: z.int().min(0),
    uniqueName: z.string().min(1),
    rank: z.int().min(0),
  })
  .strict()

const BuildDraftShardSchema = z
  .object({
    slotIndex: z.int().min(0),
    color: ShardColorSchema,
    stat: z.string().min(1),
    tauforged: z.boolean(),
  })
  .strict()

const BuildDraftGuideSchema = z
  .object({
    summary: z.string().max(400).nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .strict()

export const BuildDraftPayloadSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    visibility: VisibilitySchema.optional(),
    itemUniqueName: z.string().min(1),
    itemCategory: BrowseCategorySchema,
    organizationSlug: z.string().trim().min(1).nullable().optional(),
    guide: BuildDraftGuideSchema.optional(),
    partnerBuildSlugs: z.array(z.string().trim().min(1)).max(10).optional(),
    build: z
      .object({
        hasReactor: z.boolean(),
        slots: z.array(BuildDraftSlotSchema),
        arcanes: z.array(BuildDraftArcaneSchema).optional(),
        shards: z.array(BuildDraftShardSchema).optional(),
        helminthAbility: z
          .object({
            slotIndex: z.int().min(0),
            uniqueName: z.string().min(1),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    const slotIds = new Set<string>()
    for (const [index, slot] of payload.build.slots.entries()) {
      if (slotIds.has(slot.slotId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate slotId '${slot.slotId}'`,
          path: ["build", "slots", index, "slotId"],
        })
      }
      slotIds.add(slot.slotId)
    }

    const arcaneIndexes = new Set<number>()
    for (const [index, arcane] of (payload.build.arcanes ?? []).entries()) {
      if (arcaneIndexes.has(arcane.slotIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate arcane slotIndex '${arcane.slotIndex}'`,
          path: ["build", "arcanes", index, "slotIndex"],
        })
      }
      arcaneIndexes.add(arcane.slotIndex)
    }

    const shardIndexes = new Set<number>()
    for (const [index, shard] of (payload.build.shards ?? []).entries()) {
      if (shardIndexes.has(shard.slotIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate shard slotIndex '${shard.slotIndex}'`,
          path: ["build", "shards", index, "slotIndex"],
        })
      }
      shardIndexes.add(shard.slotIndex)
    }
  })

export type BuildDraftPayload = z.infer<typeof BuildDraftPayloadSchema>

export interface BuildStateToDraftInput {
  name: string
  description?: string | null
  visibility?: BuildVisibility
  organizationSlug?: string | null
  guide?: {
    summary?: string | null
    description?: string | null
  }
  partnerBuildSlugs?: string[]
  buildState: BuildState
}

function slotToDraft(slot: BuildState["exilusSlot"] | BuildState["auraSlots"][number]) {
  if (!slot) return null
  if (slot.formaPolarity === undefined && !slot.mod) return null

  return {
    slotId: slot.id,
    ...(slot.formaPolarity !== undefined
      ? { formaPolarity: slot.formaPolarity }
      : {}),
    ...(slot.mod
      ? {
          mod: {
            uniqueName: slot.mod.uniqueName,
            rank: slot.mod.rank,
          },
        }
      : {}),
  }
}

function normalSlotToDraft(slot: BuildState["normalSlots"][number]) {
  if (slot.formaPolarity === undefined && !slot.mod) return null

  return {
    slotId: slot.id,
    ...(slot.formaPolarity !== undefined
      ? { formaPolarity: slot.formaPolarity }
      : {}),
    ...(slot.mod
      ? {
          mod: {
            uniqueName: slot.mod.uniqueName,
            rank: slot.mod.rank,
          },
        }
      : {}),
  }
}

export function buildStateToDraftPayload(
  input: BuildStateToDraftInput,
): BuildDraftPayload {
  const slots = [
    ...input.buildState.auraSlots.map(slotToDraft),
    slotToDraft(input.buildState.exilusSlot),
    ...input.buildState.normalSlots.map(normalSlotToDraft),
  ].filter((slot): slot is NonNullable<typeof slot> => slot !== null)

  const arcanes = input.buildState.arcaneSlots.flatMap((arcane, slotIndex) =>
    arcane
      ? [
          {
            slotIndex,
            uniqueName: arcane.uniqueName,
            rank: arcane.rank,
          },
        ]
      : [],
  )

  const shards = input.buildState.shardSlots.flatMap((shard, slotIndex) =>
    shard
      ? [
          {
            slotIndex,
            color: shard.color,
            stat: shard.stat,
            tauforged: shard.tauforged,
          },
        ]
      : [],
  )

  return {
    name: input.name,
    description: input.description ?? null,
    visibility: input.visibility,
    itemUniqueName: input.buildState.itemUniqueName,
    itemCategory: input.buildState.itemCategory,
    organizationSlug: input.organizationSlug ?? null,
    guide: input.guide,
    partnerBuildSlugs: input.partnerBuildSlugs ?? [],
    build: {
      hasReactor: input.buildState.hasReactor,
      slots,
      arcanes,
      shards,
      helminthAbility: input.buildState.helminthAbility
        ? {
            slotIndex: input.buildState.helminthAbility.slotIndex,
            uniqueName: input.buildState.helminthAbility.ability.uniqueName,
          }
        : null,
    },
  }
}

export type BuildDraftPolarity = Polarity
export type BuildDraftCategory = BrowseCategory
export type BuildDraftShardColor = ShardColor
