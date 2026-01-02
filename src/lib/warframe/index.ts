// Warframe data utilities
// NOTE: items.ts uses @wfcd/items which requires Node.js fs module
// Import items.ts directly in server components only

// Client-safe exports (no Node.js dependencies)
export * from "./types";
export * from "./categories";
export * from "./images";
export * from "./arcane-images";
export * from "./slugs";
export * from "./shards";

// Server-only exports should be imported directly:
// - Static JSON (default): import { getItemsByCategory, ... } from "@/lib/warframe/items";
// - Unified API with feature flag: import { getItemsByCategory, ... } from "@/lib/warframe/data";
//
// Set USE_DATABASE=true in .env to use database queries instead of static JSON
