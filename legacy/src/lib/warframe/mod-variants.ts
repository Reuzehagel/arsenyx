// Prefix-based variants - these mods are upgraded versions of base mods
const VARIANT_PREFIXES = [
  "Primed ",
  "Amalgam ",
  "Archon ",
  "Umbral ",
  "Sacrificial ",
  "Spectral ",
]

// Galvanized mods that replace base mods with different names
const GALVANIZED_REPLACEMENTS: Record<string, string> = {
  "Galvanized Chamber": "Split Chamber",
  "Galvanized Diffusion": "Barrel Diffusion",
  "Galvanized Hell": "Hell's Chamber",
}

/**
 * Get the base name of a mod, stripping variant prefixes or resolving Galvanized replacements.
 * Used to identify mods that conflict with each other (e.g., Serration and Primed Serration).
 */
export function getModBaseName(modName: string): string {
  // Check explicit Galvanized mappings first
  if (GALVANIZED_REPLACEMENTS[modName]) {
    return GALVANIZED_REPLACEMENTS[modName]
  }

  // Strip variant prefixes
  for (const prefix of VARIANT_PREFIXES) {
    if (modName.startsWith(prefix)) {
      return modName.slice(prefix.length)
    }
  }

  return modName
}

/**
 * Check if two mods are variants of each other (share the same base name).
 * Variants cannot be equipped together on the same build.
 */
export function areModsVariants(
  modA: { name: string },
  modB: { name: string },
): boolean {
  return getModBaseName(modA.name) === getModBaseName(modB.name)
}
