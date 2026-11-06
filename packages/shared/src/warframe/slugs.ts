/** URL slug for an item name: "Excalibur Prime" → "excalibur-prime". */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      // shortcut: both quotes here are U+0027; a curly ’ falls through to the
      // hyphen rule. Changing it changes existing slugs, so it stays.
      .replace(/['']/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
  )
}
