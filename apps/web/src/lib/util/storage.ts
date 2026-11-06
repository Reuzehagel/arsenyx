/**
 * Every browser-storage key the app owns, in one table so two features can't
 * collide (the inline theme script keeps its own key — see lib/html-head.ts),
 * plus get/set/remove that never throw: storage is optional (private mode,
 * blocked cookies, a full quota), so a failure degrades to "nothing stored".
 */
export const STORAGE_KEYS = {
  /** + `storeKey` (see lib/drafts.ts). */
  editorDraftPrefix: "arsenyx:editor-draft:",
  /** + random id, sessionStorage. */
  importDraftPrefix: "arsenyx:import-draft:",
  donationNudgeShown: "arsenyx:donation-nudge-shown",
  buildLayout: "arsenyx-build-layout",
  abilityStatOrder: "arsenyx-ability-stat-order",
  guideTemplates: "arsenyx:guide-templates:v1",
  hotkeyHintDismissed: "arsenyx.hotkeyHintDismissed",
  /** Dev-only `?cssstudio=1` toggle (main.tsx). */
  cssStudio: "arsenyx.cssstudio",
} as const

type Area = "local" | "session"

const area = (a: Area): Storage =>
  a === "local" ? window.localStorage : window.sessionStorage

/** The stored value, `null` when absent, `undefined` when storage itself is
 *  unavailable (callers that must not nag in that case tell the two apart). */
export function storageGet(
  key: string,
  a: Area = "local",
): string | null | undefined {
  try {
    return area(a).getItem(key)
  } catch {
    return undefined
  }
}

/** Whether the write landed. */
export function storageSet(key: string, value: string, a: Area = "local") {
  try {
    area(a).setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function storageRemove(key: string, a: Area = "local"): void {
  try {
    area(a).removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

/** Stored keys starting with `prefix`. */
export function storageKeys(prefix: string, a: Area = "local"): string[] {
  const out: string[] = []
  try {
    const s = area(a)
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i)
      if (key?.startsWith(prefix)) out.push(key)
    }
  } catch {
    /* storage unavailable */
  }
  return out
}
