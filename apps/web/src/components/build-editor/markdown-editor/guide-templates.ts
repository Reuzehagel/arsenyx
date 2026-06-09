export interface GuideTemplate {
  id: string
  name: string
  body: string
  /** Built-ins ship with the app and can't be deleted by the user. */
  builtin?: boolean
}

/**
 * Starter scaffolds offered in the editor's template menu. Plain markdown —
 * the same renderer shows them in the preview, so they read identically to a
 * published guide.
 */
export const BUILTIN_TEMPLATES: GuideTemplate[] = [
  {
    id: "builtin:full",
    name: "Full guide",
    builtin: true,
    body: `## Overview

What this build does and why it works.

## How to play

- Step through the core gameplay loop
- Call out the key combo or rotation

## Mod choices

- **Must-have:** the mods this build is built around
- **Flex slots:** what to swap and when

## Tips & alternatives

- Budget options
- Steel Path / endgame tweaks`,
  },
  {
    id: "builtin:quick",
    name: "Quick blurb",
    builtin: true,
    body: `**TL;DR —** one-line summary of the build.

- **Strength:** what it's great at
- **Survivability:** how it stays alive
- **Best for:** the content it shines in`,
  },
  {
    id: "builtin:steel-path",
    name: "Steel Path",
    builtin: true,
    body: `## Why it works on Steel Path

The damage/survivability story against level-cap enemies.

## Rotation

1. Open with…
2. Sustain with…
3. Reset with…

## Swaps from the base build

- Replace _X_ with _Y_ for the extra armour strip / damage`,
  },
]

const STORAGE_KEY = "arsenyx:guide-templates:v1"

function safeParse(raw: string | null): GuideTemplate[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is GuideTemplate =>
        t &&
        typeof t.id === "string" &&
        typeof t.name === "string" &&
        typeof t.body === "string",
    )
  } catch {
    return []
  }
}

/** User-saved templates (this browser only). DB-backed sync is a later phase. */
export function loadUserTemplates(): GuideTemplate[] {
  if (typeof localStorage === "undefined") return []
  return safeParse(localStorage.getItem(STORAGE_KEY))
}

function persist(templates: GuideTemplate[]): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function saveUserTemplate(name: string, body: string): GuideTemplate[] {
  const trimmedName = name.trim()
  const template: GuideTemplate = {
    // Math.random/Date are fine in app code (only banned in workflow scripts).
    id: `user:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName || "Untitled template",
    body,
  }
  const next = [...loadUserTemplates(), template]
  persist(next)
  return next
}

export function deleteUserTemplate(id: string): GuideTemplate[] {
  const next = loadUserTemplates().filter((t) => t.id !== id)
  persist(next)
  return next
}
