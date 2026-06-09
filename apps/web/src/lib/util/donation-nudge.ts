// One-time, per-browser gate for the post-publish donation nudge.
//
// The ask should fire at most once per user — whether they tip, dismiss, or
// ignore it. We persist a single flag in localStorage; if storage is
// unavailable (private mode, blocked) we treat the nudge as already shown so
// we never nag in a context where we can't remember having asked.

const STORAGE_KEY = "arsenyx:donation-nudge-shown"

export function hasShownDonationNudge(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return true
  }
}

export function markDonationNudgeShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    // Best-effort: if we can't persist, the nudge simply won't repeat-suppress.
  }
}
