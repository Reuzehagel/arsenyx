#!/usr/bin/env node

/**
 * Sync Warframe data from @wfcd/items package
 * Run: bun run sync-data
 */

import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_FILES = [
  "Warframes.json",
  "Primary.json",
  "Secondary.json",
  "Melee.json",
  "Sentinels.json",
  "Pets.json",
  "SentinelWeapons.json",
  "Misc.json",
  "Mods.json",
  "Arcanes.json",
  "Archwing.json",
  "Arch-Gun.json",
  "Arch-Melee.json",
];

const SOURCE_DIR = join(process.cwd(), "node_modules/@wfcd/items/data/json");
const DEST_DIR = join(process.cwd(), "src/data/warframe");

console.log("🔄 Syncing Warframe data...\n");

// Ensure destination directory exists
if (!existsSync(DEST_DIR)) {
  mkdirSync(DEST_DIR, { recursive: true });
  console.log(`📁 Created directory: ${DEST_DIR}`);
}

// Copy each data file
let copied = 0;
let failed = 0;

for (const file of DATA_FILES) {
  const sourcePath = join(SOURCE_DIR, file);
  const destPath = join(DEST_DIR, file);

  if (!existsSync(sourcePath)) {
    console.log(`❌ Not found: ${file}`);
    failed++;
    continue;
  }

  try {
    copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied: ${file}`);
    copied++;
  } catch (error) {
    console.log(`❌ Failed to copy ${file}: ${error}`);
    failed++;
  }
}

console.log(`\n📊 Summary: ${copied} copied, ${failed} failed`);

if (failed > 0) {
  console.log("\n💡 Try running: bun update @wfcd/items");
  process.exit(1);
}

console.log("\n✨ Warframe data synced successfully!");
