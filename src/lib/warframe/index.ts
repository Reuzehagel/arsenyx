// Warframe data utilities
// NOTE: items.ts uses @wfcd/items which requires Node.js fs module
// Import items.ts directly in server components only

// Client-safe exports (no Node.js dependencies)
export * from "./types"
export * from "./categories"
export * from "./formatting"
export * from "./images"
export * from "./arcane-images"
export * from "./slugs"
export * from "./shards"
export * from "./mod-card-config"
export * from "./mod-variants"

// Stats calculation system (client-safe)
export * from "./stat-types"
export * from "./stat-caps"
export * from "./stat-parser"
export * from "./aura-effects"
export * from "./stats"

// Server-only exports should be imported directly:
// import { getItemsByCategory, ... } from "@/lib/warframe/items";
// import { getAllMods, ... } from "@/lib/warframe/mods";
