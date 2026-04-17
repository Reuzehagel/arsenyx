import { z } from "zod"

// =============================================================================
// SHARED ENUMS
// =============================================================================

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

const SlotTypeSchema = z.enum(["aura", "exilus", "normal", "arcane"])

const ShardColorSchema = z.enum([
  "crimson",
  "amber",
  "azure",
  "topaz",
  "violet",
  "emerald",
])

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

const LevelStatsSchema = z.array(z.object({ stats: z.array(z.string()) }))

// =============================================================================
// BUILD STATE SCHEMAS — validates user-generated buildData stored in DB
// =============================================================================

const PlacedModSchema = z.object({
  uniqueName: z.string(),
  name: z.string(),
  imageName: z.string().optional(),
  polarity: PolaritySchema,
  baseDrain: z.number(),
  fusionLimit: z.number(),
  rank: z.number(),
  rarity: z.string(),
  compatName: z.string().optional(),
  type: z.string().optional(),
  levelStats: LevelStatsSchema.optional(),
  modSet: z.string().optional(),
  modSetStats: z.array(z.string()).optional(),
  isExilus: z.boolean().optional(),
  isUtility: z.boolean().optional(),
})

const PlacedArcaneSchema = z.object({
  uniqueName: z.string(),
  name: z.string(),
  imageName: z.string().optional(),
  rank: z.number(),
  rarity: z.string().optional(),
})

const PlacedShardSchema = z.object({
  color: ShardColorSchema,
  stat: z.string(),
  tauforged: z.boolean(),
})

const HelminthAbilitySchema = z.object({
  uniqueName: z.string(),
  name: z.string(),
  imageName: z.string().optional(),
  source: z.string(),
  description: z.string().optional(),
})

const ModSlotSchema = z.object({
  id: z.string(),
  type: SlotTypeSchema,
  innatePolarity: PolaritySchema.optional(),
  formaPolarity: PolaritySchema.optional(),
  mod: PlacedModSchema.optional(),
})

export const BuildStateSchema = z
  .object({
    itemUniqueName: z.string(),
    itemName: z.string(),
    itemCategory: BrowseCategorySchema,
    itemImageName: z.string().optional(),

    hasReactor: z.boolean(),

    auraSlots: z.array(ModSlotSchema).optional(),
    // Backward compat: old builds stored a single auraSlot object
    auraSlot: ModSlotSchema.optional(),
    exilusSlot: ModSlotSchema.optional(),
    normalSlots: z.array(ModSlotSchema),
    arcaneSlots: z.array(PlacedArcaneSchema.nullable()),

    shardSlots: z.array(PlacedShardSchema.nullable()),

    baseCapacity: z.number(),
    currentCapacity: z.number(),

    buildName: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),

    formaCount: z.number(),

    helminthAbility: z
      .object({
        slotIndex: z.number(),
        ability: HelminthAbilitySchema,
      })
      .optional(),
  })
  .transform((data) => {
    // Migrate old auraSlot to auraSlots array
    const { auraSlot, ...rest } = data
    const auraSlots =
      rest.auraSlots ?? (auraSlot ? [auraSlot] : [])
    return { ...rest, auraSlots }
  })

// =============================================================================
// ITEM SCHEMA — minimal shape check for WFCD item data (union type is too complex)
// =============================================================================

export const ItemDataSchema = z
  .object({
    uniqueName: z.string(),
    name: z.string(),
  })
  .passthrough()

// =============================================================================
// MOD / ARCANE SCHEMAS — loose validation for WFCD data from trusted source
// =============================================================================

export const ModDataSchema = z
  .object({
    uniqueName: z.string(),
    name: z.string(),
    polarity: PolaritySchema,
    rarity: z.string(),
    baseDrain: z.number(),
    fusionLimit: z.number(),
    type: z.string(),
    tradable: z.boolean(),
  })
  .passthrough() // Allow extra WFCD fields we don't validate

export const ArcaneDataSchema = z
  .object({
    uniqueName: z.string(),
    name: z.string(),
    rarity: z.string(),
    type: z.string(),
    tradable: z.boolean(),
  })
  .passthrough() // Allow extra WFCD fields

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Safely parse JSON data with a Zod schema, logging warnings on failure.
 * Returns the parsed data on success, or null on failure.
 */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
): T | null {
  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }
  console.warn(`[schema] Invalid ${context}:`, result.error.issues.slice(0, 3))
  return null
}

/**
 * Parse JSON data with a Zod schema, falling back to unsafe cast on failure.
 * Use this during migration — lets invalid data through with a warning
 * instead of breaking the app.
 */
export function safeParseOrCast<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
): T {
  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }
  console.warn(
    `[schema] Invalid ${context}, falling back to cast:`,
    result.error.issues.slice(0, 3),
  )
  return data as T
}
