/**
 * WFCD Data Sync Script
 *
 * Syncs Warframe item data from local JSON files (sourced from @wfcd/items)
 * to the Postgres database.
 *
 * Usage: bun run scripts/sync-wfcd-to-db.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Data directory path
const DATA_DIR = join(process.cwd(), "src/data/warframe");

// Read JSON file helper
function readJsonFile<T>(filename: string): T {
  const filePath = join(DATA_DIR, filename);
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

// Types for raw WFCD data
interface WfcdItem {
  uniqueName: string;
  name: string;
  description?: string;
  imageName?: string;
  category?: string;
  masteryReq?: number;
  isPrime?: boolean;
  vaulted?: boolean;
  tradable?: boolean;
  releaseDate?: string;
  type?: string;
  [key: string]: unknown;
}

interface WfcdMod {
  uniqueName: string;
  name: string;
  description?: string;
  imageName?: string;
  polarity?: string;
  rarity?: string;
  baseDrain?: number;
  fusionLimit?: number;
  compatName?: string;
  type?: string;
  tradable?: boolean;
  isAugment?: boolean;
  isExilus?: boolean;
  [key: string]: unknown;
}

interface WfcdArcane {
  uniqueName: string;
  name: string;
  description?: string;
  imageName?: string;
  rarity?: string;
  type?: string;
  tradable?: boolean;
  [key: string]: unknown;
}

// Browse category mapping
type BrowseCategory =
  | "warframes"
  | "primary"
  | "secondary"
  | "melee"
  | "necramechs"
  | "companions"
  | "archwing";

/**
 * Check if an item is a Necramech
 */
function isNecramech(item: WfcdItem): boolean {
  return (
    item.category === "Warframes" &&
    (item.name.includes("Necramech") ||
      item.name === "Bonewidow" ||
      item.name === "Voidrig")
  );
}

/**
 * Determine the browse category for an item
 */
function getBrowseCategory(item: WfcdItem): BrowseCategory | null {
  // Skip blueprints and Helminth
  if (!item.name || item.name.includes(" Blueprint")) return null;
  if (item.name === "Helminth") return null;

  const category = item.category as string;

  if (category === "Warframes") {
    return isNecramech(item) ? "necramechs" : "warframes";
  }
  if (category === "Primary") return "primary";
  if (category === "Secondary") return "secondary";
  if (category === "Melee") return "melee";
  if (category === "Sentinels" || category === "Pets") return "companions";
  if (
    category === "Archwing" ||
    category === "Arch-Gun" ||
    category === "Arch-Melee"
  ) {
    return "archwing";
  }

  return null;
}

/**
 * Check if a mod should be included (filter out variants, rivens, etc.)
 */
function shouldIncludeMod(mod: WfcdMod): boolean {
  if (!mod.name) return false;
  if (mod.name.includes("Riven Mod")) return false;
  if (!mod.compatName && !mod.type) return false;
  if (mod.baseDrain === undefined || mod.fusionLimit === undefined)
    return false;

  const uniqueName = mod.uniqueName ?? "";
  if (uniqueName.includes("/Beginner/")) return false;
  if (uniqueName.endsWith("Intermediate")) return false;
  if (uniqueName.endsWith("Expert") && !mod.name.includes("Primed"))
    return false;
  if (uniqueName.includes("/Nemesis/")) return false;
  if (uniqueName.endsWith("SubMod")) return false;

  return true;
}

/**
 * Normalize polarity string
 */
function normalizePolarity(polarity?: string): string {
  if (!polarity) return "universal";
  const lower = polarity.toLowerCase();

  const polarityMap: Record<string, string> = {
    madurai: "madurai",
    vazarin: "vazarin",
    naramon: "naramon",
    zenurik: "zenurik",
    unairu: "unairu",
    penjaga: "penjaga",
    umbra: "umbra",
    universal: "universal",
    d: "vazarin",
    r: "madurai",
    dash: "naramon",
    v: "madurai",
  };

  return polarityMap[lower] ?? "universal";
}

/**
 * Sync all items to the database
 */
async function syncItems(): Promise<number> {
  console.log("Syncing items...");

  // Load all item data files
  const warframes = readJsonFile<WfcdItem[]>("Warframes.json");
  const primary = readJsonFile<WfcdItem[]>("Primary.json");
  const secondary = readJsonFile<WfcdItem[]>("Secondary.json");
  const melee = readJsonFile<WfcdItem[]>("Melee.json");
  const sentinels = readJsonFile<WfcdItem[]>("Sentinels.json");
  const pets = readJsonFile<WfcdItem[]>("Pets.json");
  const archwing = readJsonFile<WfcdItem[]>("Archwing.json");
  const archGun = readJsonFile<WfcdItem[]>("Arch-Gun.json");
  const archMelee = readJsonFile<WfcdItem[]>("Arch-Melee.json");

  const allItems: WfcdItem[] = [
    ...warframes,
    ...primary,
    ...secondary,
    ...melee,
    ...sentinels,
    ...pets,
    ...archwing,
    ...archGun,
    ...archMelee,
  ];

  let count = 0;

  for (const item of allItems) {
    const browseCategory = getBrowseCategory(item);
    if (!browseCategory) continue;

    // Determine if this item supports shards (only Warframes, not Necramechs)
    const supportsShards =
      browseCategory === "warframes" && item.category === "Warframes";

    await prisma.item.upsert({
      where: { uniqueName: item.uniqueName },
      create: {
        uniqueName: item.uniqueName,
        name: item.name,
        description: item.description ?? null,
        imageName: item.imageName ?? null,
        category: item.category ?? "Unknown",
        browseCategory,
        tradable: item.tradable ?? false,
        masteryReq: item.masteryReq ?? null,
        isPrime: item.isPrime ?? item.name.includes("Prime"),
        vaulted: item.vaulted ?? false,
        releaseDate: item.releaseDate ? new Date(item.releaseDate) : null,
        supportsShards,
        data: item as object,
      },
      update: {
        name: item.name,
        description: item.description ?? null,
        imageName: item.imageName ?? null,
        category: item.category ?? "Unknown",
        browseCategory,
        tradable: item.tradable ?? false,
        masteryReq: item.masteryReq ?? null,
        isPrime: item.isPrime ?? item.name.includes("Prime"),
        vaulted: item.vaulted ?? false,
        releaseDate: item.releaseDate ? new Date(item.releaseDate) : null,
        supportsShards,
        data: item as object,
        syncedAt: new Date(),
      },
    });

    count++;
  }

  console.log(`  Synced ${count} items`);
  return count;
}

/**
 * Sync all mods to the database
 */
async function syncMods(): Promise<number> {
  console.log("Syncing mods...");

  const mods = readJsonFile<WfcdMod[]>("Mods.json");
  let count = 0;

  for (const mod of mods) {
    if (!shouldIncludeMod(mod)) continue;

    await prisma.mod.upsert({
      where: { uniqueName: mod.uniqueName },
      create: {
        uniqueName: mod.uniqueName,
        name: mod.name,
        description: mod.description ?? null,
        imageName: mod.imageName ?? null,
        polarity: normalizePolarity(mod.polarity),
        rarity: mod.rarity ?? "Common",
        baseDrain: mod.baseDrain!,
        fusionLimit: mod.fusionLimit!,
        compatName: mod.compatName ?? null,
        type: mod.type ?? "Unknown",
        tradable: mod.tradable ?? false,
        isAugment: mod.isAugment ?? false,
        isPrime: mod.name?.startsWith("Primed ") ?? false,
        isExilus: mod.isExilus ?? false,
        data: mod as object,
      },
      update: {
        name: mod.name,
        description: mod.description ?? null,
        imageName: mod.imageName ?? null,
        polarity: normalizePolarity(mod.polarity),
        rarity: mod.rarity ?? "Common",
        baseDrain: mod.baseDrain!,
        fusionLimit: mod.fusionLimit!,
        compatName: mod.compatName ?? null,
        type: mod.type ?? "Unknown",
        tradable: mod.tradable ?? false,
        isAugment: mod.isAugment ?? false,
        isPrime: mod.name?.startsWith("Primed ") ?? false,
        isExilus: mod.isExilus ?? false,
        data: mod as object,
        syncedAt: new Date(),
      },
    });

    count++;
  }

  console.log(`  Synced ${count} mods`);
  return count;
}

/**
 * Sync all arcanes to the database
 */
async function syncArcanes(): Promise<number> {
  console.log("Syncing arcanes...");

  const arcanes = readJsonFile<WfcdArcane[]>("Arcanes.json");
  let count = 0;

  for (const arcane of arcanes) {
    if (!arcane.name) continue;

    // Determine arcane type for filtering
    const type = arcane.type?.toLowerCase() ?? "";
    let arcaneType = "Unknown";

    if (type.includes("magus") || type.includes("operator")) {
      arcaneType = "Operator";
    } else if (
      type.includes("exodia") ||
      type.includes("pax") ||
      type.includes("virtuos")
    ) {
      arcaneType = "Weapon";
    } else if (type === "arcane" || type.includes("arcane enhancement")) {
      arcaneType = "Warframe";
    }

    await prisma.arcane.upsert({
      where: { uniqueName: arcane.uniqueName },
      create: {
        uniqueName: arcane.uniqueName,
        name: arcane.name,
        description: arcane.description ?? null,
        imageName: arcane.imageName ?? null,
        rarity: arcane.rarity ?? "Common",
        type: arcaneType,
        tradable: arcane.tradable ?? false,
        data: arcane as object,
      },
      update: {
        name: arcane.name,
        description: arcane.description ?? null,
        imageName: arcane.imageName ?? null,
        rarity: arcane.rarity ?? "Common",
        type: arcaneType,
        tradable: arcane.tradable ?? false,
        data: arcane as object,
        syncedAt: new Date(),
      },
    });

    count++;
  }

  console.log(`  Synced ${count} arcanes`);
  return count;
}

/**
 * Main sync function
 */
async function main() {
  const triggeredBy = process.argv[2] ?? "manual";

  console.log("Starting WFCD data sync...");
  console.log(`Triggered by: ${triggeredBy}`);

  // Create sync log entry
  const log = await prisma.wfcdSyncLog.create({
    data: {
      status: "running",
      triggeredBy,
    },
  });

  try {
    const itemsUpdated = await syncItems();
    const modsUpdated = await syncMods();
    const arcanesUpdated = await syncArcanes();

    // Update log with success
    await prisma.wfcdSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        itemsUpdated,
        modsUpdated,
        arcanesUpdated,
      },
    });

    // Ensure GIN index exists for full-text search
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_builds_search_vector
      ON builds USING GIN("searchVector")
    `);
    console.log("✓ GIN index on searchVector ensured");

    console.log("\nSync completed successfully!");
    console.log(`  Items: ${itemsUpdated}`);
    console.log(`  Mods: ${modsUpdated}`);
    console.log(`  Arcanes: ${arcanesUpdated}`);
  } catch (error) {
    // Update log with failure
    await prisma.wfcdSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(error),
      },
    });

    console.error("Sync failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
